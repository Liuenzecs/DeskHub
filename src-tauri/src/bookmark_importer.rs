use std::{
    collections::BTreeMap,
    fs,
    path::Path,
};

use anyhow::{Context, Result, anyhow};
use serde::Deserialize;
use url::Url;

use crate::models::{BrowserBookmarkCandidate, BrowserBookmarkScanResponse, BrowserBookmarkSource};

#[derive(Clone, Copy)]
struct BrowserSpec {
    name: &'static str,
    relative_path: &'static [&'static str],
}

const BROWSER_SPECS: [BrowserSpec; 2] = [
    BrowserSpec {
        name: "Chrome",
        relative_path: &["Google", "Chrome", "User Data"],
    },
    BrowserSpec {
        name: "Edge",
        relative_path: &["Microsoft", "Edge", "User Data"],
    },
];

#[derive(Debug, Deserialize)]
struct BookmarkFile {
    roots: BTreeMap<String, BookmarkNode>,
}

#[derive(Debug, Default, Deserialize)]
struct BookmarkNode {
    #[serde(default)]
    name: String,
    #[serde(rename = "type", default)]
    node_type: String,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    children: Vec<BookmarkNode>,
}

pub fn scan_browser_bookmarks() -> Result<BrowserBookmarkScanResponse> {
    #[cfg(target_os = "windows")]
    {
        let local_app_data = std::env::var_os("LOCALAPPDATA")
            .ok_or_else(|| anyhow!("LOCALAPPDATA is not available in the current environment."))?;
        return scan_browser_bookmarks_from_local_app_data(Path::new(&local_app_data));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(anyhow!(
            "Browser bookmark import currently supports Windows Chrome / Edge bookmark files."
        ))
    }
}

#[cfg_attr(not(test), allow(dead_code))]
pub fn scan_browser_bookmarks_from_local_app_data(
    local_app_data: &Path,
) -> Result<BrowserBookmarkScanResponse> {
    let mut sources = Vec::new();
    let mut candidates = Vec::new();

    for browser in BROWSER_SPECS {
        collect_browser_candidates(local_app_data, browser, &mut sources, &mut candidates)?;
    }

    sources.sort_by(|left, right| {
        left.browser
            .cmp(&right.browser)
            .then_with(|| left.profile_name.cmp(&right.profile_name))
    });
    candidates.sort_by(|left, right| {
        left.browser
            .cmp(&right.browser)
            .then_with(|| left.profile_name.cmp(&right.profile_name))
            .then_with(|| left.folder_path.cmp(&right.folder_path))
            .then_with(|| left.name.cmp(&right.name))
            .then_with(|| left.url.cmp(&right.url))
    });

    Ok(BrowserBookmarkScanResponse {
        source_count: sources.len(),
        candidate_count: candidates.len(),
        importable_count: 0,
        existing_count: 0,
        sources,
        candidates,
    })
}

fn collect_browser_candidates(
    local_app_data: &Path,
    browser: BrowserSpec,
    sources: &mut Vec<BrowserBookmarkSource>,
    candidates: &mut Vec<BrowserBookmarkCandidate>,
) -> Result<()> {
    let user_data_dir = browser
        .relative_path
        .iter()
        .fold(local_app_data.to_path_buf(), |path, segment| path.join(segment));

    if !user_data_dir.exists() {
        return Ok(());
    }

    let mut profile_directories = fs::read_dir(&user_data_dir)
        .with_context(|| format!("Failed to read {}.", user_data_dir.display()))?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            if !file_type.is_dir() {
                return None;
            }

            let profile_name = entry.file_name().to_string_lossy().trim().to_string();
            if profile_name == "Default" || profile_name.starts_with("Profile ") {
                Some((profile_name, entry.path()))
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    profile_directories.sort_by(|left, right| left.0.cmp(&right.0));

    for (profile_name, profile_path) in profile_directories {
        let bookmarks_path = profile_path.join("Bookmarks");
        if !bookmarks_path.is_file() {
            continue;
        }

        let profile_candidates =
            parse_bookmarks_file(&bookmarks_path, browser.name, profile_name.as_str())?;
        if profile_candidates.is_empty() {
            continue;
        }

        sources.push(BrowserBookmarkSource {
            id: format!("{}::{}", browser.name.to_ascii_lowercase(), profile_name),
            browser: browser.name.to_string(),
            profile_name: profile_name.clone(),
            bookmarks_path: bookmarks_path.display().to_string(),
            bookmark_count: profile_candidates.len(),
        });
        candidates.extend(profile_candidates);
    }

    Ok(())
}

fn parse_bookmarks_file(
    bookmarks_path: &Path,
    browser: &str,
    profile_name: &str,
) -> Result<Vec<BrowserBookmarkCandidate>> {
    let contents = fs::read_to_string(bookmarks_path)
        .with_context(|| format!("Failed to read {}.", bookmarks_path.display()))?;
    let bookmark_file: BookmarkFile = serde_json::from_str(&contents)
        .with_context(|| format!("Failed to parse {}.", bookmarks_path.display()))?;

    let mut candidates = Vec::new();
    for (root_key, root_node) in &bookmark_file.roots {
        let root_label = root_label(root_key.as_str(), root_node.name.as_str());
        let mut root_path = Vec::new();
        if !root_label.is_empty() {
            root_path.push(root_label);
        }

        for child in &root_node.children {
            collect_bookmark_nodes(
                child,
                browser,
                profile_name,
                bookmarks_path,
                &root_path,
                &mut candidates,
            );
        }
    }

    Ok(candidates)
}

fn collect_bookmark_nodes(
    node: &BookmarkNode,
    browser: &str,
    profile_name: &str,
    bookmarks_path: &Path,
    parent_path: &[String],
    candidates: &mut Vec<BrowserBookmarkCandidate>,
) {
    match node.node_type.as_str() {
        "url" => {
            let Some(url) = normalize_bookmark_url(node.url.as_deref()) else {
                return;
            };

            let name = bookmark_title(node.name.as_str(), url.as_str());
            let folder_path = parent_path.join(" / ");
            let id = format!(
                "{}::{}::{}::{}::{}",
                browser.to_ascii_lowercase(),
                profile_name,
                folder_path,
                name,
                url
            );

            candidates.push(BrowserBookmarkCandidate {
                id,
                browser: browser.to_string(),
                profile_name: profile_name.to_string(),
                source_path: bookmarks_path.display().to_string(),
                name,
                url,
                folder_path,
                existing_item_id: None,
                existing_item_name: None,
            });
        }
        _ => {
            let mut next_path = parent_path.to_vec();
            let folder_name = node.name.trim();

            if !folder_name.is_empty()
                && next_path.last().map(String::as_str) != Some(folder_name)
            {
                next_path.push(folder_name.to_string());
            }

            for child in &node.children {
                collect_bookmark_nodes(
                    child,
                    browser,
                    profile_name,
                    bookmarks_path,
                    &next_path,
                    candidates,
                );
            }
        }
    }
}

fn normalize_bookmark_url(value: Option<&str>) -> Option<String> {
    let raw = value?.trim();
    if raw.is_empty() {
        return None;
    }

    let mut url = Url::parse(raw).ok()?;
    match url.scheme() {
        "http" | "https" => {
            url.set_fragment(None);
            Some(url.to_string())
        }
        _ => None,
    }
}

fn bookmark_title(name: &str, url: &str) -> String {
    let trimmed_name = name.trim();
    if !trimmed_name.is_empty() {
        return trimmed_name.to_string();
    }

    Url::parse(url)
        .ok()
        .and_then(|value| value.host_str().map(|host| host.to_string()))
        .unwrap_or_else(|| url.to_string())
}

fn root_label(root_key: &str, fallback_name: &str) -> String {
    match root_key {
        "bookmark_bar" => "书签栏".to_string(),
        "other" => "其他收藏夹".to_string(),
        "synced" => "同步".to_string(),
        _ if !fallback_name.trim().is_empty() => fallback_name.trim().to_string(),
        _ => root_key.trim().to_string(),
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::scan_browser_bookmarks_from_local_app_data;

    #[test]
    fn scans_chrome_and_edge_bookmarks_from_default_profiles() {
        let temp_dir = tempdir().expect("temp dir");
        let chrome_default = temp_dir
            .path()
            .join("Google")
            .join("Chrome")
            .join("User Data")
            .join("Default");
        let edge_profile = temp_dir
            .path()
            .join("Microsoft")
            .join("Edge")
            .join("User Data")
            .join("Profile 1");

        fs::create_dir_all(&chrome_default).expect("chrome profile");
        fs::create_dir_all(&edge_profile).expect("edge profile");

        fs::write(
            chrome_default.join("Bookmarks"),
            serde_json::json!({
                "roots": {
                    "bookmark_bar": {
                        "type": "folder",
                        "name": "Bookmarks bar",
                        "children": [
                            {
                                "type": "folder",
                                "name": "开发",
                                "children": [
                                    {
                                        "type": "url",
                                        "name": "DeskHub Docs",
                                        "url": "https://example.com/docs"
                                    }
                                ]
                            }
                        ]
                    }
                }
            })
            .to_string(),
        )
        .expect("chrome bookmarks");

        fs::write(
            edge_profile.join("Bookmarks"),
            serde_json::json!({
                "roots": {
                    "other": {
                        "type": "folder",
                        "children": [
                            {
                                "type": "url",
                                "name": "DeskHub Repo",
                                "url": "https://github.com/example/deskhub"
                            },
                            {
                                "type": "url",
                                "name": "Edge Settings",
                                "url": "edge://settings"
                            }
                        ]
                    }
                }
            })
            .to_string(),
        )
        .expect("edge bookmarks");

        let scan = scan_browser_bookmarks_from_local_app_data(temp_dir.path()).expect("scan");

        assert_eq!(scan.source_count, 2);
        assert_eq!(scan.candidate_count, 2);
        assert_eq!(scan.importable_count, 0);
        assert_eq!(scan.existing_count, 0);
        assert!(
            scan.sources
                .iter()
                .any(|source| source.browser == "Chrome" && source.profile_name == "Default")
        );
        assert!(
            scan.sources
                .iter()
                .any(|source| source.browser == "Edge" && source.profile_name == "Profile 1")
        );
        assert!(
            scan.candidates
                .iter()
                .any(|candidate| candidate.folder_path == "书签栏 / 开发")
        );
        assert!(
            scan.candidates
                .iter()
                .all(|candidate| candidate.url.starts_with("https://"))
        );
    }

    #[test]
    fn ignores_non_profile_directories_and_invalid_urls() {
        let temp_dir = tempdir().expect("temp dir");
        let chrome_guest = temp_dir
            .path()
            .join("Google")
            .join("Chrome")
            .join("User Data")
            .join("Guest Profile");
        let chrome_default = temp_dir
            .path()
            .join("Google")
            .join("Chrome")
            .join("User Data")
            .join("Default");

        fs::create_dir_all(&chrome_guest).expect("guest");
        fs::create_dir_all(&chrome_default).expect("default");

        fs::write(
            chrome_default.join("Bookmarks"),
            serde_json::json!({
                "roots": {
                    "bookmark_bar": {
                        "type": "folder",
                        "children": [
                            {
                                "type": "url",
                                "name": "",
                                "url": "https://example.com"
                            },
                            {
                                "type": "url",
                                "name": "Local File",
                                "url": "file:///C:/demo.txt"
                            }
                        ]
                    }
                }
            })
            .to_string(),
        )
        .expect("bookmarks");

        let scan = scan_browser_bookmarks_from_local_app_data(temp_dir.path()).expect("scan");

        assert_eq!(scan.source_count, 1);
        assert_eq!(scan.candidate_count, 1);
        assert_eq!(scan.candidates[0].name, "example.com");
    }
}
