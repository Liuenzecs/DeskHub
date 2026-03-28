use anyhow::Result;
use rusqlite::Connection;

const TARGET_SCHEMA_VERSION: i64 = 6;

pub fn run_migrations(connection: &mut Connection) -> Result<()> {
    let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;

    if version < 1 {
        migrate_v1_init(connection)?;
    }

    if version < 2 {
        migrate_v2_command_modes_and_history(connection)?;
    }

    if version < 3 {
        migrate_v3_workflow_step_metadata(connection)?;
    }

    if version < 4 {
        migrate_v4_data_tool_history(connection)?;
    }

    if version < 5 {
        migrate_v5_workflow_variables(connection)?;
    }

    if version < TARGET_SCHEMA_VERSION {
        migrate_v6_workflow_flow_control(connection)?;
    }

    Ok(())
}

fn migrate_v1_init(connection: &Connection) -> Result<()> {
    connection.execute_batch(
        "
        BEGIN;
        CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT NOT NULL,
            icon TEXT NOT NULL DEFAULT '',
            favorite INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_launched_at TEXT NULL,
            launch_target TEXT NULL,
            project_path TEXT NULL,
            dev_command TEXT NULL,
            path TEXT NULL,
            url TEXT NULL,
            command TEXT NULL
        );
        CREATE TABLE IF NOT EXISTS item_tags (
            item_id TEXT NOT NULL,
            tag TEXT NOT NULL,
            PRIMARY KEY (item_id, tag),
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS workflow_steps (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            type TEXT NOT NULL,
            path TEXT NULL,
            url TEXT NULL,
            command TEXT NULL,
            FOREIGN KEY (workflow_id) REFERENCES items(id) ON DELETE CASCADE,
            UNIQUE (workflow_id, position)
        );
        CREATE TABLE IF NOT EXISTS workflow_variables (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            key TEXT NOT NULL,
            label TEXT NOT NULL,
            default_value TEXT NOT NULL DEFAULT '',
            required INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (workflow_id) REFERENCES items(id) ON DELETE CASCADE,
            UNIQUE (workflow_id, position),
            UNIQUE (workflow_id, key)
        );
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
        CREATE INDEX IF NOT EXISTS idx_items_favorite ON items(favorite);
        CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_items_last_launched_at ON items(last_launched_at DESC);
        CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag);
        CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_position ON workflow_steps(workflow_id, position);
        CREATE INDEX IF NOT EXISTS idx_workflow_variables_workflow_position ON workflow_variables(workflow_id, position);
        PRAGMA user_version = 1;
        COMMIT;
        ",
    )?;

    Ok(())
}

fn migrate_v2_command_modes_and_history(connection: &Connection) -> Result<()> {
    connection.execute_batch("BEGIN;")?;

    let migration = (|| -> Result<()> {
        if !column_exists(connection, "items", "execution_mode")? {
            connection.execute("ALTER TABLE items ADD COLUMN execution_mode TEXT NULL", [])?;
        }

        if !column_exists(connection, "workflow_steps", "execution_mode")? {
            connection.execute(
                "ALTER TABLE workflow_steps ADD COLUMN execution_mode TEXT NULL",
                [],
            )?;
        }

        connection.execute(
            "
            CREATE TABLE IF NOT EXISTS command_history (
                kind TEXT NOT NULL,
                target TEXT NOT NULL,
                title TEXT NOT NULL,
                last_used_at TEXT NOT NULL,
                use_count INTEGER NOT NULL,
                PRIMARY KEY (kind, target)
            )
            ",
            [],
        )?;

        connection.execute(
            "
            UPDATE items
            SET execution_mode = 'blocking'
            WHERE type = 'script' AND (execution_mode IS NULL OR TRIM(execution_mode) = '')
            ",
            [],
        )?;

        connection.execute(
            "
            UPDATE workflow_steps
            SET execution_mode = 'blocking'
            WHERE type = 'run_command' AND (execution_mode IS NULL OR TRIM(execution_mode) = '')
            ",
            [],
        )?;

        connection.pragma_update(None, "user_version", 2)?;
        Ok(())
    })();

    match migration {
        Ok(()) => {
            connection.execute_batch("COMMIT;")?;
            Ok(())
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK;");
            Err(error)
        }
    }
}

fn migrate_v3_workflow_step_metadata(connection: &Connection) -> Result<()> {
    connection.execute_batch("BEGIN;")?;

    let migration = (|| -> Result<()> {
        if !column_exists(connection, "workflow_steps", "note")? {
            connection.execute(
                "ALTER TABLE workflow_steps ADD COLUMN note TEXT NOT NULL DEFAULT ''",
                [],
            )?;
        }

        if !column_exists(connection, "workflow_steps", "delay_ms")? {
            connection.execute(
                "ALTER TABLE workflow_steps ADD COLUMN delay_ms INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
        }

        connection.execute(
            "
            UPDATE workflow_steps
            SET note = ''
            WHERE note IS NULL
            ",
            [],
        )?;

        connection.execute(
            "
            UPDATE workflow_steps
            SET delay_ms = 0
            WHERE delay_ms IS NULL OR delay_ms < 0
            ",
            [],
        )?;

        connection.pragma_update(None, "user_version", 3)?;
        Ok(())
    })();

    match migration {
        Ok(()) => {
            connection.execute_batch("COMMIT;")?;
            Ok(())
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK;");
            Err(error)
        }
    }
}

fn migrate_v4_data_tool_history(connection: &Connection) -> Result<()> {
    connection.execute_batch("BEGIN;")?;

    let migration = (|| -> Result<()> {
        connection.execute(
            "
            CREATE TABLE IF NOT EXISTS data_tool_history (
                id TEXT PRIMARY KEY,
                action TEXT NOT NULL,
                status TEXT NOT NULL,
                title TEXT NOT NULL,
                summary TEXT NOT NULL,
                occurred_at TEXT NOT NULL,
                source_path TEXT NULL,
                output_path TEXT NULL,
                backup_path TEXT NULL,
                item_names_json TEXT NOT NULL DEFAULT '[]',
                errors_json TEXT NOT NULL DEFAULT '[]',
                extra_json TEXT NOT NULL DEFAULT '{}'
            )
            ",
            [],
        )?;
        connection.execute(
            "
            CREATE INDEX IF NOT EXISTS idx_data_tool_history_occurred_at
            ON data_tool_history(occurred_at DESC)
            ",
            [],
        )?;

        connection.pragma_update(None, "user_version", 4)?;
        Ok(())
    })();

    match migration {
        Ok(()) => {
            connection.execute_batch("COMMIT;")?;
            Ok(())
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK;");
            Err(error)
        }
    }
}

fn migrate_v5_workflow_variables(connection: &Connection) -> Result<()> {
    connection.execute_batch("BEGIN;")?;

    let migration = (|| -> Result<()> {
        connection.execute(
            "
            CREATE TABLE IF NOT EXISTS workflow_variables (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                position INTEGER NOT NULL,
                key TEXT NOT NULL,
                label TEXT NOT NULL,
                default_value TEXT NOT NULL DEFAULT '',
                required INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (workflow_id) REFERENCES items(id) ON DELETE CASCADE,
                UNIQUE (workflow_id, position),
                UNIQUE (workflow_id, key)
            )
            ",
            [],
        )?;

        connection.execute(
            "
            CREATE INDEX IF NOT EXISTS idx_workflow_variables_workflow_position
            ON workflow_variables(workflow_id, position)
            ",
            [],
        )?;

        if !column_exists(connection, "workflow_steps", "failure_strategy")? {
            connection.execute(
                "ALTER TABLE workflow_steps ADD COLUMN failure_strategy TEXT NOT NULL DEFAULT 'stop'",
                [],
            )?;
        }

        connection.execute(
            "
            UPDATE workflow_steps
            SET failure_strategy = 'stop'
            WHERE failure_strategy IS NULL OR TRIM(failure_strategy) = ''
            ",
            [],
        )?;

        connection.pragma_update(None, "user_version", 5)?;
        Ok(())
    })();

    match migration {
        Ok(()) => {
            connection.execute_batch("COMMIT;")?;
            Ok(())
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK;");
            Err(error)
        }
    }
}

fn migrate_v6_workflow_flow_control(connection: &Connection) -> Result<()> {
    connection.execute_batch("BEGIN;")?;

    let migration = (|| -> Result<()> {
        if !column_exists(connection, "workflow_steps", "retry_count")? {
            connection.execute(
                "ALTER TABLE workflow_steps ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
        }

        if !column_exists(connection, "workflow_steps", "retry_delay_ms")? {
            connection.execute(
                "ALTER TABLE workflow_steps ADD COLUMN retry_delay_ms INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
        }

        if !column_exists(connection, "workflow_steps", "condition_variable_key")? {
            connection.execute(
                "ALTER TABLE workflow_steps ADD COLUMN condition_variable_key TEXT NULL",
                [],
            )?;
        }

        if !column_exists(connection, "workflow_steps", "condition_operator")? {
            connection.execute(
                "ALTER TABLE workflow_steps ADD COLUMN condition_operator TEXT NULL",
                [],
            )?;
        }

        if !column_exists(connection, "workflow_steps", "condition_value")? {
            connection.execute(
                "ALTER TABLE workflow_steps ADD COLUMN condition_value TEXT NULL",
                [],
            )?;
        }

        if !column_exists(connection, "workflow_steps", "condition_on_false")? {
            connection.execute(
                "ALTER TABLE workflow_steps ADD COLUMN condition_on_false TEXT NULL",
                [],
            )?;
        }

        if !column_exists(connection, "workflow_steps", "condition_jump_to_step_id")? {
            connection.execute(
                "ALTER TABLE workflow_steps ADD COLUMN condition_jump_to_step_id TEXT NULL",
                [],
            )?;
        }

        connection.execute(
            "
            UPDATE workflow_steps
            SET retry_count = 0, retry_delay_ms = 0
            WHERE retry_count IS NULL OR retry_delay_ms IS NULL
            ",
            [],
        )?;

        connection.execute(
            "
            UPDATE workflow_steps
            SET failure_strategy = 'stop'
            WHERE failure_strategy IS NULL OR TRIM(failure_strategy) = ''
            ",
            [],
        )?;

        connection.pragma_update(None, "user_version", TARGET_SCHEMA_VERSION)?;
        Ok(())
    })();

    match migration {
        Ok(()) => {
            connection.execute_batch("COMMIT;")?;
            Ok(())
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK;");
            Err(error)
        }
    }
}
fn column_exists(connection: &Connection, table: &str, column: &str) -> Result<bool> {
    let mut statement = connection.prepare(&format!("PRAGMA table_info({table})"))?;
    let mut rows = statement.query([])?;

    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(true);
        }
    }

    Ok(false)
}
