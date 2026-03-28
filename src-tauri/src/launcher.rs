use std::{thread, time::Duration};

use anyhow::{Result, anyhow};

use crate::models::{
    CommandExecutionMode, DeskItem, WorkflowConditionFailAction, WorkflowConditionOperator,
    WorkflowStep, WorkflowStepCondition, WorkflowStepResult, WorkflowStepStatus,
    WorkflowVariableInput,
};
use crate::platform_launcher::{launch_app, launch_project, open_path, open_url, run_command};

#[derive(Debug, Clone)]
pub struct LaunchIssue {
    pub message: String,
    pub failed_step_index: Option<usize>,
    pub failed_step_type: Option<String>,
    pub failed_step_value: Option<String>,
    pub started_step_index: Option<usize>,
    pub executed_step_count: Option<usize>,
    pub total_step_count: Option<usize>,
    pub used_workflow_variables: Option<Vec<WorkflowVariableInput>>,
    pub warning_count: Option<usize>,
    pub step_results: Option<Vec<WorkflowStepResult>>,
}

#[derive(Debug, Clone, Default)]
pub struct LaunchSummary {
    pub started_step_index: Option<usize>,
    pub executed_step_count: Option<usize>,
    pub total_step_count: Option<usize>,
    pub used_workflow_variables: Option<Vec<WorkflowVariableInput>>,
    pub warning_count: Option<usize>,
    pub step_results: Option<Vec<WorkflowStepResult>>,
}

impl LaunchIssue {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            failed_step_index: None,
            failed_step_type: None,
            failed_step_value: None,
            started_step_index: None,
            executed_step_count: None,
            total_step_count: None,
            used_workflow_variables: None,
            warning_count: None,
            step_results: None,
        }
    }

    fn workflow(index: usize, step: &WorkflowStep, message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            failed_step_index: Some(index),
            failed_step_type: Some(workflow_step_type(step).into()),
            failed_step_value: Some(summarize_workflow_step_value(step)),
            started_step_index: None,
            executed_step_count: None,
            total_step_count: None,
            used_workflow_variables: None,
            warning_count: None,
            step_results: None,
        }
    }
}

pub fn launch(item: &DeskItem) -> Result<LaunchSummary, LaunchIssue> {
    match item {
        DeskItem::App { launch_target, .. } => {
            launch_app(launch_target).map_err(to_issue)?;
            Ok(LaunchSummary::default())
        }
        DeskItem::Project {
            project_path,
            dev_command,
            ..
        } => {
            launch_project(item.name(), project_path, dev_command).map_err(to_issue)?;
            Ok(LaunchSummary::default())
        }
        DeskItem::Folder { path, .. } => {
            open_path(path).map_err(to_issue)?;
            Ok(LaunchSummary::default())
        }
        DeskItem::Url { url, .. } => {
            open_url(url).map_err(to_issue)?;
            Ok(LaunchSummary::default())
        }
        DeskItem::Script {
            command,
            execution_mode,
            ..
        } => {
            run_command(command, None, *execution_mode, Some(item.name())).map_err(to_issue)?;
            Ok(LaunchSummary::default())
        }
        DeskItem::Workflow { .. } => launch_workflow(item, 0, &[]),
    }
}

pub fn launch_workflow(
    item: &DeskItem,
    start_step_index: usize,
    variable_inputs: &[WorkflowVariableInput],
) -> Result<LaunchSummary, LaunchIssue> {
    let DeskItem::Workflow {
        steps, variables, ..
    } = item
    else {
        return Err(LaunchIssue::new(
            "Only workflow items support partial execution.",
        ));
    };

    if steps.is_empty() {
        return Err(LaunchIssue::new(
            "This workflow does not contain any steps.",
        ));
    }

    if start_step_index >= steps.len() {
        return Err(LaunchIssue::new(format!(
            "Workflow step {} is out of range.",
            start_step_index + 1
        )));
    }

    let resolved_variables = resolve_workflow_variables(variables, variable_inputs)
        .map_err(|error| LaunchIssue::new(error.to_string()))?;
    let resolved_steps = steps
        .iter()
        .map(|step| resolve_workflow_step(step, &resolved_variables))
        .collect::<Vec<_>>();

    let trace = match run_workflow_steps_with_runner(
        &resolved_steps,
        start_step_index,
        &resolved_variables,
        execute_step,
    ) {
        Ok(trace) => trace,
        Err(mut issue) => {
            issue.used_workflow_variables = Some(resolved_variables.clone());
            return Err(issue);
        }
    };

    Ok(LaunchSummary {
        started_step_index: Some(start_step_index),
        executed_step_count: Some(trace.executed_step_count),
        total_step_count: Some(steps.len()),
        used_workflow_variables: Some(resolved_variables),
        warning_count: Some(trace.warning_count),
        step_results: Some(trace.step_results),
    })
}

pub fn open_existing_path(target: &str) -> Result<()> {
    open_path(target)
}

fn resolve_workflow_variables(
    variables: &[crate::models::WorkflowVariable],
    variable_inputs: &[WorkflowVariableInput],
) -> Result<Vec<WorkflowVariableInput>> {
    let input_map = variable_inputs
        .iter()
        .map(WorkflowVariableInput::normalized)
        .map(|entry| (entry.key, entry.value))
        .collect::<std::collections::HashMap<_, _>>();

    let mut resolved = Vec::new();

    for variable in variables {
        let value = input_map
            .get(&variable.key)
            .cloned()
            .unwrap_or_else(|| variable.default_value.clone());
        let normalized_value = value.trim().to_string();

        if variable.required && normalized_value.is_empty() {
            return Err(anyhow!(
                "Workflow variable \"{}\" is required.",
                if variable.label.trim().is_empty() {
                    variable.key.as_str()
                } else {
                    variable.label.as_str()
                }
            ));
        }

        resolved.push(WorkflowVariableInput {
            key: variable.key.clone(),
            value: normalized_value,
        });
    }

    Ok(resolved)
}

fn replace_workflow_tokens(
    value: &str,
    variables: &std::collections::HashMap<String, String>,
) -> String {
    let mut output = String::new();
    let mut cursor = 0;

    while let Some(relative_start) = value[cursor..].find("{{") {
        let start = cursor + relative_start;
        output.push_str(&value[cursor..start]);

        let search_from = start + 2;
        if let Some(relative_end) = value[search_from..].find("}}") {
            let end = search_from + relative_end;
            let key = value[search_from..end].trim();
            output.push_str(variables.get(key).map(String::as_str).unwrap_or(""));
            cursor = end + 2;
        } else {
            output.push_str(&value[start..]);
            cursor = value.len();
            break;
        }
    }

    if cursor < value.len() {
        output.push_str(&value[cursor..]);
    }

    output
}

fn resolve_workflow_step(
    step: &WorkflowStep,
    resolved_variables: &[WorkflowVariableInput],
) -> WorkflowStep {
    let variable_map = resolved_variables
        .iter()
        .map(|entry| (entry.key.clone(), entry.value.clone()))
        .collect::<std::collections::HashMap<_, _>>();

    match step {
        WorkflowStep::OpenPath {
            id,
            path,
            note,
            delay_ms,
            condition,
        } => WorkflowStep::OpenPath {
            id: id.clone(),
            path: replace_workflow_tokens(path, &variable_map),
            note: replace_workflow_tokens(note, &variable_map),
            delay_ms: *delay_ms,
            condition: condition.as_ref().map(|value| WorkflowStepCondition {
                variable_key: value.variable_key.clone(),
                operator: value.operator,
                value: replace_workflow_tokens(&value.value, &variable_map),
                on_false_action: value.on_false_action,
                jump_to_step_id: value.jump_to_step_id.clone(),
            }),
        },
        WorkflowStep::OpenUrl {
            id,
            url,
            note,
            delay_ms,
            condition,
        } => WorkflowStep::OpenUrl {
            id: id.clone(),
            url: replace_workflow_tokens(url, &variable_map),
            note: replace_workflow_tokens(note, &variable_map),
            delay_ms: *delay_ms,
            condition: condition.as_ref().map(|value| WorkflowStepCondition {
                variable_key: value.variable_key.clone(),
                operator: value.operator,
                value: replace_workflow_tokens(&value.value, &variable_map),
                on_false_action: value.on_false_action,
                jump_to_step_id: value.jump_to_step_id.clone(),
            }),
        },
        WorkflowStep::RunCommand {
            id,
            command,
            execution_mode,
            failure_strategy,
            retry_count,
            retry_delay_ms,
            note,
            delay_ms,
            condition,
        } => WorkflowStep::RunCommand {
            id: id.clone(),
            command: replace_workflow_tokens(command, &variable_map),
            execution_mode: *execution_mode,
            failure_strategy: *failure_strategy,
            retry_count: *retry_count,
            retry_delay_ms: *retry_delay_ms,
            note: replace_workflow_tokens(note, &variable_map),
            delay_ms: *delay_ms,
            condition: condition.as_ref().map(|value| WorkflowStepCondition {
                variable_key: value.variable_key.clone(),
                operator: value.operator,
                value: replace_workflow_tokens(&value.value, &variable_map),
                on_false_action: value.on_false_action,
                jump_to_step_id: value.jump_to_step_id.clone(),
            }),
        },
    }
}

fn to_issue(error: anyhow::Error) -> LaunchIssue {
    LaunchIssue::new(error.to_string())
}

fn workflow_step_type(step: &WorkflowStep) -> &'static str {
    match step {
        WorkflowStep::OpenPath { .. } => "open_path",
        WorkflowStep::OpenUrl { .. } => "open_url",
        WorkflowStep::RunCommand { .. } => "run_command",
    }
}

fn workflow_step_label(step: &WorkflowStep) -> &'static str {
    match step {
        WorkflowStep::OpenPath { .. } => "打开路径",
        WorkflowStep::OpenUrl { .. } => "打开网站",
        WorkflowStep::RunCommand { .. } => "运行命令",
    }
}

fn summarize_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= 96 {
        return trimmed.to_string();
    }

    let shortened = trimmed.chars().take(96).collect::<String>();
    format!("{shortened}...")
}

fn summarize_workflow_step_value(step: &WorkflowStep) -> String {
    match step {
        WorkflowStep::OpenPath { path, .. } => summarize_value(path),
        WorkflowStep::OpenUrl { url, .. } => summarize_value(url),
        WorkflowStep::RunCommand { command, .. } => summarize_value(command),
    }
}

fn workflow_step_delay_ms(step: &WorkflowStep) -> u64 {
    match step {
        WorkflowStep::OpenPath { delay_ms, .. }
        | WorkflowStep::OpenUrl { delay_ms, .. }
        | WorkflowStep::RunCommand { delay_ms, .. } => *delay_ms,
    }
}

fn execute_step(step: &WorkflowStep) -> Result<()> {
    let delay_ms = workflow_step_delay_ms(step);
    if delay_ms > 0 {
        thread::sleep(Duration::from_millis(delay_ms));
    }

    execute_step_with_handlers(step, open_path, open_url, run_command)
}

fn execute_step_with_handlers<PO, UO, CO>(
    step: &WorkflowStep,
    mut open_path_handler: PO,
    mut open_url_handler: UO,
    mut command_handler: CO,
) -> Result<()>
where
    PO: FnMut(&str) -> Result<()>,
    UO: FnMut(&str) -> Result<()>,
    CO: FnMut(&str, Option<&str>, CommandExecutionMode, Option<&str>) -> Result<()>,
{
    match step {
        WorkflowStep::OpenPath { path, .. } => open_path_handler(path),
        WorkflowStep::OpenUrl { url, .. } => open_url_handler(url),
        WorkflowStep::RunCommand {
            command,
            execution_mode,
            ..
        } => command_handler(command, None, *execution_mode, None),
    }
}

#[derive(Debug, Default)]
struct WorkflowExecutionTrace {
    executed_step_count: usize,
    warning_count: usize,
    step_results: Vec<WorkflowStepResult>,
}

#[derive(Debug)]
struct StepExecutionStop {
    attempts: usize,
    error: anyhow::Error,
}

#[derive(Debug)]
enum StepExecutionOutcome {
    Completed {
        attempts: usize,
        message: Option<String>,
    },
    Continued {
        attempts: usize,
        message: String,
    },
}

fn workflow_step_id(step: &WorkflowStep) -> &str {
    match step {
        WorkflowStep::OpenPath { id, .. }
        | WorkflowStep::OpenUrl { id, .. }
        | WorkflowStep::RunCommand { id, .. } => id.as_str(),
    }
}

fn workflow_step_condition(step: &WorkflowStep) -> Option<&WorkflowStepCondition> {
    match step {
        WorkflowStep::OpenPath { condition, .. }
        | WorkflowStep::OpenUrl { condition, .. }
        | WorkflowStep::RunCommand { condition, .. } => condition.as_ref(),
    }
}

fn summarize_condition(condition: &WorkflowStepCondition) -> String {
    let variable_label = format!("变量 {}", condition.variable_key.trim());
    match condition.operator {
        WorkflowConditionOperator::Equals => {
            format!(
                "{variable_label} 等于 {}",
                summarize_value(&condition.value)
            )
        }
        WorkflowConditionOperator::NotEquals => {
            format!(
                "{variable_label} 不等于 {}",
                summarize_value(&condition.value)
            )
        }
        WorkflowConditionOperator::Contains => {
            format!(
                "{variable_label} 包含 {}",
                summarize_value(&condition.value)
            )
        }
        WorkflowConditionOperator::NotContains => {
            format!(
                "{variable_label} 不包含 {}",
                summarize_value(&condition.value)
            )
        }
        WorkflowConditionOperator::IsEmpty => format!("{variable_label} 为空"),
        WorkflowConditionOperator::NotEmpty => format!("{variable_label} 不为空"),
    }
}

fn evaluate_step_condition(
    condition: &WorkflowStepCondition,
    variables: &std::collections::HashMap<String, String>,
) -> bool {
    let actual_value = variables
        .get(condition.variable_key.trim())
        .map(String::as_str)
        .unwrap_or("")
        .trim();
    let expected_value = condition.value.trim();

    match condition.operator {
        WorkflowConditionOperator::Equals => actual_value == expected_value,
        WorkflowConditionOperator::NotEquals => actual_value != expected_value,
        WorkflowConditionOperator::Contains => actual_value.contains(expected_value),
        WorkflowConditionOperator::NotContains => !actual_value.contains(expected_value),
        WorkflowConditionOperator::IsEmpty => actual_value.is_empty(),
        WorkflowConditionOperator::NotEmpty => !actual_value.is_empty(),
    }
}

fn execute_step_with_strategy<F>(
    step: &WorkflowStep,
    mut runner: F,
) -> Result<StepExecutionOutcome, StepExecutionStop>
where
    F: FnMut(&WorkflowStep) -> Result<()>,
{
    match step {
        WorkflowStep::RunCommand {
            failure_strategy,
            retry_count,
            retry_delay_ms,
            ..
        } => match failure_strategy {
            crate::models::WorkflowFailureStrategy::Continue => match runner(step) {
                Ok(()) => Ok(StepExecutionOutcome::Completed {
                    attempts: 1,
                    message: None,
                }),
                Err(error) => Ok(StepExecutionOutcome::Continued {
                    attempts: 1,
                    message: error.to_string(),
                }),
            },
            crate::models::WorkflowFailureStrategy::Retry => {
                let total_attempts = (*retry_count as usize).saturating_add(1).max(1);
                let mut last_error = None;

                for attempt in 1..=total_attempts {
                    match runner(step) {
                        Ok(()) => {
                            return Ok(StepExecutionOutcome::Completed {
                                attempts: attempt,
                                message: (attempt > 1)
                                    .then(|| format!("命令在第 {attempt} 次尝试后成功。")),
                            });
                        }
                        Err(error) => {
                            last_error = Some(error);
                            if attempt < total_attempts && *retry_delay_ms > 0 {
                                thread::sleep(Duration::from_millis(*retry_delay_ms));
                            }
                        }
                    }
                }

                Err(StepExecutionStop {
                    attempts: total_attempts,
                    error: last_error.unwrap_or_else(|| anyhow!("Command failed.")),
                })
            }
            crate::models::WorkflowFailureStrategy::Stop => {
                runner(step).map_err(|error| StepExecutionStop { attempts: 1, error })?;
                Ok(StepExecutionOutcome::Completed {
                    attempts: 1,
                    message: None,
                })
            }
        },
        _ => {
            runner(step).map_err(|error| StepExecutionStop { attempts: 1, error })?;
            Ok(StepExecutionOutcome::Completed {
                attempts: 1,
                message: None,
            })
        }
    }
}

fn run_workflow_steps_with_runner<F>(
    steps: &[WorkflowStep],
    start_step_index: usize,
    resolved_variables: &[WorkflowVariableInput],
    mut runner: F,
) -> Result<WorkflowExecutionTrace, LaunchIssue>
where
    F: FnMut(&WorkflowStep) -> Result<()>,
{
    let variable_map = resolved_variables
        .iter()
        .map(|entry| (entry.key.clone(), entry.value.clone()))
        .collect::<std::collections::HashMap<_, _>>();
    let step_index_by_id = steps
        .iter()
        .enumerate()
        .map(|(index, step)| (workflow_step_id(step).to_string(), index))
        .collect::<std::collections::HashMap<_, _>>();

    let mut trace = WorkflowExecutionTrace::default();
    let mut current_index = start_step_index;
    let mut iterations = 0usize;
    let max_iterations = steps.len().saturating_mul(64).max(64);

    while current_index < steps.len() {
        iterations += 1;
        let step = &steps[current_index];

        if iterations > max_iterations {
            let mut issue = LaunchIssue::workflow(
                current_index,
                step,
                format!(
                    "工作流在第 {} 步附近检测到可能的条件跳转循环，已停止执行。目标：{}",
                    current_index + 1,
                    summarize_workflow_step_value(step)
                ),
            );
            issue.started_step_index = Some(start_step_index);
            issue.executed_step_count = Some(trace.executed_step_count);
            issue.total_step_count = Some(steps.len());
            issue.warning_count = Some(trace.warning_count);
            issue.step_results = Some(trace.step_results);
            return Err(issue);
        }

        if let Some(condition) = workflow_step_condition(step) {
            if !evaluate_step_condition(condition, &variable_map) {
                match condition.on_false_action {
                    WorkflowConditionFailAction::Skip => {
                        trace.step_results.push(WorkflowStepResult {
                            step_id: workflow_step_id(step).to_string(),
                            step_index: current_index,
                            status: WorkflowStepStatus::Skipped,
                            attempts: 0,
                            message: Some(format!(
                                "条件未满足，已跳过：{}。",
                                summarize_condition(condition)
                            )),
                            target_step_id: None,
                            target_step_index: None,
                        });
                        current_index += 1;
                        continue;
                    }
                    WorkflowConditionFailAction::Jump => {
                        let Some(target_step_id) = condition
                            .jump_to_step_id
                            .as_ref()
                            .map(|value| value.trim())
                            .filter(|value| !value.is_empty())
                        else {
                            let mut issue = LaunchIssue::workflow(
                                current_index,
                                step,
                                format!(
                                    "工作流第 {} 步条件未满足，但没有配置可跳转的目标步骤。",
                                    current_index + 1
                                ),
                            );
                            issue.started_step_index = Some(start_step_index);
                            issue.executed_step_count = Some(trace.executed_step_count);
                            issue.total_step_count = Some(steps.len());
                            issue.warning_count = Some(trace.warning_count);
                            issue.step_results = Some(trace.step_results);
                            return Err(issue);
                        };

                        let Some(target_step_index) = step_index_by_id.get(target_step_id).copied()
                        else {
                            let mut issue = LaunchIssue::workflow(
                                current_index,
                                step,
                                format!(
                                    "工作流第 {} 步条件未满足，配置的跳转目标 {} 不存在。",
                                    current_index + 1,
                                    target_step_id
                                ),
                            );
                            issue.started_step_index = Some(start_step_index);
                            issue.executed_step_count = Some(trace.executed_step_count);
                            issue.total_step_count = Some(steps.len());
                            issue.warning_count = Some(trace.warning_count);
                            issue.step_results = Some(trace.step_results);
                            return Err(issue);
                        };

                        trace.step_results.push(WorkflowStepResult {
                            step_id: workflow_step_id(step).to_string(),
                            step_index: current_index,
                            status: WorkflowStepStatus::Jumped,
                            attempts: 0,
                            message: Some(format!(
                                "条件未满足，跳转到第 {} 步：{}。",
                                target_step_index + 1,
                                summarize_condition(condition)
                            )),
                            target_step_id: Some(target_step_id.to_string()),
                            target_step_index: Some(target_step_index),
                        });
                        current_index = target_step_index;
                        continue;
                    }
                }
            }
        }

        match execute_step_with_strategy(step, &mut runner) {
            Ok(StepExecutionOutcome::Completed { attempts, message }) => {
                trace.step_results.push(WorkflowStepResult {
                    step_id: workflow_step_id(step).to_string(),
                    step_index: current_index,
                    status: WorkflowStepStatus::Completed,
                    attempts,
                    message,
                    target_step_id: None,
                    target_step_index: None,
                });
                trace.executed_step_count += 1;
                current_index += 1;
            }
            Ok(StepExecutionOutcome::Continued { attempts, message }) => {
                trace.step_results.push(WorkflowStepResult {
                    step_id: workflow_step_id(step).to_string(),
                    step_index: current_index,
                    status: WorkflowStepStatus::Continued,
                    attempts,
                    message: Some(format!("步骤失败但按策略继续：{}。", message)),
                    target_step_id: None,
                    target_step_index: None,
                });
                trace.executed_step_count += 1;
                trace.warning_count += 1;
                current_index += 1;
            }
            Err(stop) => {
                trace.step_results.push(WorkflowStepResult {
                    step_id: workflow_step_id(step).to_string(),
                    step_index: current_index,
                    status: WorkflowStepStatus::Failed,
                    attempts: stop.attempts,
                    message: Some(stop.error.to_string()),
                    target_step_id: None,
                    target_step_index: None,
                });

                let attempt_hint = if stop.attempts > 1 {
                    format!("在 {} 次尝试后仍然", stop.attempts)
                } else {
                    "已".to_string()
                };
                let mut issue = LaunchIssue::workflow(
                    current_index,
                    step,
                    format!(
                        "工作流第 {} 步（{}）{}失败：{}。目标：{}",
                        current_index + 1,
                        workflow_step_label(step),
                        attempt_hint,
                        stop.error,
                        summarize_workflow_step_value(step)
                    ),
                );
                issue.started_step_index = Some(start_step_index);
                issue.executed_step_count = Some(trace.executed_step_count);
                issue.total_step_count = Some(steps.len());
                issue.warning_count = Some(trace.warning_count);
                issue.step_results = Some(trace.step_results);
                return Err(issue);
            }
        }
    }

    Ok(trace)
}

#[cfg(test)]
mod tests {
    use std::{cell::RefCell, rc::Rc};

    #[cfg(target_os = "windows")]
    use std::{fs, path::Path};

    use anyhow::anyhow;
    #[cfg(target_os = "windows")]
    use tempfile::tempdir;

    use super::{execute_step_with_handlers, run_workflow_steps_with_runner};
    use crate::models::{
        CommandExecutionMode, WorkflowFailureStrategy, WorkflowStep, WorkflowVariable,
        WorkflowVariableInput,
    };
    #[cfg(target_os = "windows")]
    use crate::platform_launcher::windows::{
        build_launch_script, build_new_terminal_command, normalize_command_for_launch_script,
        should_launch_via_shell,
    };

    fn open_path_step(id: &str, path: &str) -> WorkflowStep {
        WorkflowStep::OpenPath {
            id: id.into(),
            path: path.into(),
            note: String::new(),
            delay_ms: 0,
            condition: None,
        }
    }

    fn open_url_step(id: &str, url: &str) -> WorkflowStep {
        WorkflowStep::OpenUrl {
            id: id.into(),
            url: url.into(),
            note: String::new(),
            delay_ms: 0,
            condition: None,
        }
    }

    fn run_command_step(
        id: &str,
        command: &str,
        execution_mode: CommandExecutionMode,
    ) -> WorkflowStep {
        WorkflowStep::RunCommand {
            id: id.into(),
            command: command.into(),
            execution_mode,
            failure_strategy: WorkflowFailureStrategy::Stop,
            retry_count: 0,
            retry_delay_ms: 0,
            note: String::new(),
            delay_ms: 0,
            condition: None,
        }
    }

    #[test]
    fn workflow_stops_on_first_failed_step() {
        let steps = vec![
            open_path_step("1", "C:\\One"),
            run_command_step("2", "bad-command", CommandExecutionMode::Blocking),
            open_url_step("3", "https://example.com"),
        ];

        let executed: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
        let executed_clone = Rc::clone(&executed);

        let error = run_workflow_steps_with_runner(&steps, 0, &[], move |step| {
            executed_clone.borrow_mut().push(match step {
                WorkflowStep::OpenPath { id, .. }
                | WorkflowStep::OpenUrl { id, .. }
                | WorkflowStep::RunCommand { id, .. } => id.clone(),
            });

            match step {
                WorkflowStep::RunCommand { .. } => Err(anyhow!("boom")),
                _ => Ok(()),
            }
        })
        .expect_err("workflow should stop");

        assert_eq!(error.failed_step_index, Some(1));
        assert_eq!(error.failed_step_type.as_deref(), Some("run_command"));
        assert_eq!(error.failed_step_value.as_deref(), Some("bad-command"));
        assert!(error.message.contains("工作流第 2 步"));
        assert_eq!(
            executed.borrow().as_slice(),
            &["1".to_string(), "2".to_string()]
        );
    }

    #[test]
    fn new_terminal_and_background_steps_continue_after_spawn() {
        let steps = vec![
            run_command_step("1", "npm run dev", CommandExecutionMode::NewTerminal),
            run_command_step("2", "npm run worker", CommandExecutionMode::Background),
            open_url_step("3", "https://example.com"),
        ];

        let seen_ids = Rc::new(RefCell::new(Vec::new()));
        let seen_modes = Rc::new(RefCell::new(Vec::new()));
        let seen_ids_clone = Rc::clone(&seen_ids);
        let seen_modes_clone = Rc::clone(&seen_modes);

        run_workflow_steps_with_runner(&steps, 0, &[], move |step| {
            seen_ids_clone.borrow_mut().push(match step {
                WorkflowStep::OpenPath { id, .. }
                | WorkflowStep::OpenUrl { id, .. }
                | WorkflowStep::RunCommand { id, .. } => id.clone(),
            });

            execute_step_with_handlers(
                &step,
                |_| Ok(()),
                |_| Ok(()),
                |_, _, mode, _| {
                    seen_modes_clone.borrow_mut().push(mode);
                    Ok(())
                },
            )
        })
        .expect("workflow should continue");
        assert_eq!(
            seen_ids.borrow().as_slice(),
            &["1".to_string(), "2".to_string(), "3".to_string()]
        );
        assert_eq!(
            seen_modes.borrow().as_slice(),
            &[
                CommandExecutionMode::NewTerminal,
                CommandExecutionMode::Background
            ]
        );
    }

    #[test]
    fn workflow_can_start_from_middle_step() {
        let steps = vec![
            open_path_step("1", "C:\\One"),
            run_command_step("2", "npm run dev", CommandExecutionMode::NewTerminal),
            open_url_step("3", "https://example.com"),
        ];

        let seen_ids = Rc::new(RefCell::new(Vec::new()));
        let seen_ids_clone = Rc::clone(&seen_ids);

        let trace = run_workflow_steps_with_runner(&steps, 1, &[], move |step| {
            seen_ids_clone.borrow_mut().push(match step {
                WorkflowStep::OpenPath { id, .. }
                | WorkflowStep::OpenUrl { id, .. }
                | WorkflowStep::RunCommand { id, .. } => id.clone(),
            });
            Ok(())
        })
        .expect("workflow should continue from second step");

        assert_eq!(trace.executed_step_count, 2);
        assert_eq!(
            seen_ids.borrow().as_slice(),
            &["2".to_string(), "3".to_string()]
        );
    }

    #[test]
    fn workflow_variables_resolve_defaults_and_placeholders() {
        let variables = vec![
            WorkflowVariable {
                id: "var-1".into(),
                key: "projectPath".into(),
                label: "项目目录".into(),
                default_value: r"C:\dev\DeskHub".into(),
                required: true,
            },
            WorkflowVariable {
                id: "var-2".into(),
                key: "port".into(),
                label: "端口".into(),
                default_value: "4173".into(),
                required: false,
            },
        ];

        let resolved_variables = super::resolve_workflow_variables(
            &variables,
            &[WorkflowVariableInput {
                key: "port".into(),
                value: "3000".into(),
            }],
        )
        .expect("variables should resolve");

        let mut template_step = run_command_step(
            "step-1",
            "cd /D {{ projectPath }} && pnpm dev --port {{port}}",
            CommandExecutionMode::NewTerminal,
        );
        if let WorkflowStep::RunCommand { note, .. } = &mut template_step {
            *note = "鍚姩 {{projectPath}}".into();
        }
        if let WorkflowStep::RunCommand { note, .. } = &mut template_step {
            *note = "启动 {{projectPath}}".into();
        }
        let resolved_step = super::resolve_workflow_step(&template_step, &resolved_variables);
        /*
                let resolved_step = super::resolve_workflow_step(
                    &WorkflowStep::RunCommand {
                        id: "step-1".into(),
                        command: "cd /D {{ projectPath }} && pnpm dev --port {{port}}".into(),
                        execution_mode: CommandExecutionMode::NewTerminal,
                        failure_strategy: WorkflowFailureStrategy::Stop,
                        note: "启动 {{projectPath}}".into(),
                        delay_ms: 0,
                    },
                    &resolved_variables,
                );
        */

        assert_eq!(
            resolved_variables,
            vec![
                WorkflowVariableInput {
                    key: "projectPath".into(),
                    value: r"C:\dev\DeskHub".into(),
                },
                WorkflowVariableInput {
                    key: "port".into(),
                    value: "3000".into(),
                },
            ]
        );

        match resolved_step {
            WorkflowStep::RunCommand { command, note, .. } => {
                assert_eq!(command, r"cd /D C:\dev\DeskHub && pnpm dev --port 3000");
                assert_eq!(note, r"启动 C:\dev\DeskHub");
            }
            _ => panic!("expected run_command"),
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn launch_script_includes_working_directory_before_command() {
        let script = build_launch_script("pnpm dev", Some(r"C:\dev\DeskHub"));

        assert!(script.contains(r#"cd /D "C:\dev\DeskHub""#));
        assert!(script.contains("if errorlevel 1 exit /b 1"));
        assert!(script.contains("pnpm dev"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn new_terminal_command_uses_script_path_instead_of_raw_command() {
        let command = build_new_terminal_command(
            Path::new(r"C:\Users\demo\AppData\Local\Temp\deskhub-launcher\test.cmd"),
            Some("DeskHub API"),
        );

        assert!(command.contains(r#"start "DeskHub · DeskHub API" cmd /D /K"#));
        assert!(
            command.contains(r#""C:\Users\demo\AppData\Local\Temp\deskhub-launcher\test.cmd""#)
        );
        assert!(!command.contains("pnpm dev"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn launch_script_wraps_direct_batch_files_with_call() {
        let directory = tempdir().expect("temp dir should exist");
        let script_path = directory.path().join("dev-script.cmd");
        fs::write(&script_path, "@echo off\r\necho hello").expect("script should be written");

        let normalized =
            normalize_command_for_launch_script(script_path.to_string_lossy().as_ref());

        assert_eq!(normalized, format!(r#"call "{}""#, script_path.display()));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn launch_script_wraps_direct_powershell_files() {
        let directory = tempdir().expect("temp dir should exist");
        let script_path = directory.path().join("dev-script.ps1");
        fs::write(&script_path, "Write-Host hello").expect("script should be written");

        let normalized =
            normalize_command_for_launch_script(script_path.to_string_lossy().as_ref());

        assert_eq!(
            normalized,
            format!(
                r#"powershell -NoProfile -ExecutionPolicy Bypass -File "{}""#,
                script_path.display()
            )
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_shortcuts_launch_via_shell() {
        assert!(should_launch_via_shell(Path::new(
            r"C:\Users\demo\DeskHub.lnk"
        )));
        assert!(!should_launch_via_shell(Path::new(
            r"C:\Users\demo\DeskHub.exe"
        )));
    }
}
