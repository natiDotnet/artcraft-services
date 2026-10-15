use sqlx::{MySqlConnection, Row};
use super::types::DeveloperApiKeyInfo;

/// Ensure the developer_api_keys table exists (self-healing for all environments).
pub async fn ensure_developer_api_keys_table(
  conn: &mut MySqlConnection,
) -> Result<(), sqlx::Error> {
  sqlx::query(
    r#"
CREATE TABLE IF NOT EXISTS developer_api_keys (
  id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  token VARCHAR(32) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  maybe_description VARCHAR(512) DEFAULT NULL,
  owner_user_token VARCHAR(32) NOT NULL,
  ip_address_creation VARCHAR(40) NOT NULL,
  ip_address_update VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  maybe_deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY (token),
  UNIQUE KEY (api_key),
  KEY fk_dev_owner_user_token (owner_user_token),
  KEY index_dev_maybe_deleted_at (maybe_deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
    "#,
  )
  .execute(&mut *conn)
  .await?;

  Ok(())
}

/// Insert a new developer API key into developer_api_keys table.
pub async fn insert_developer_key(
  conn: &mut MySqlConnection,
  token: &str,
  api_key: &str,
  name: &str,
  maybe_description: Option<&str>,
  owner_user_token: &str,
  ip_address: &str,
) -> Result<(), sqlx::Error> {
  ensure_developer_api_keys_table(conn).await?;

  sqlx::query(
    r#"
INSERT INTO developer_api_keys (
  token,
  api_key,
  name,
  maybe_description,
  owner_user_token,
  ip_address_creation,
  ip_address_update,
  created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    "#,
  )
  .bind(token)
  .bind(api_key)
  .bind(name)
  .bind(maybe_description)
  .bind(owner_user_token)
  .bind(ip_address)
  .bind(ip_address)
  .execute(&mut *conn)
  .await?;

  Ok(())
}

/// List developer API keys for a specific user.
pub async fn list_developer_keys(
  conn: &mut MySqlConnection,
  owner_user_token: &str,
  limit: u32,
  offset: u32,
) -> Result<Vec<DeveloperApiKeyInfo>, sqlx::Error> {
  ensure_developer_api_keys_table(conn).await?;

  let rows = sqlx::query(
    r#"
SELECT
  token,
  api_key,
  name,
  maybe_description,
  total_spend,
  owner_user_token,
  ip_address_creation,
  ip_address_update,
  created_at,
  updated_at,
  maybe_deleted_at
FROM developer_api_keys
WHERE owner_user_token = ?
ORDER BY id DESC
LIMIT ? OFFSET ?
    "#,
  )
  .bind(owner_user_token)
  .bind(limit)
  .bind(offset)
  .fetch_all(&mut *conn)
  .await?;

  let mut result = Vec::with_capacity(rows.len());
  for row in rows {
    let full_key: String = row.try_get("api_key").unwrap_or_default();
    let truncated_api_key = if full_key.len() > 20 {
      full_key[..20].to_string()
    } else {
      full_key.clone()
    };

    let created_at: chrono::DateTime<chrono::Utc> = row.try_get("created_at").unwrap_or_else(|_| chrono::Utc::now());
    let updated_at: chrono::DateTime<chrono::Utc> = row.try_get("updated_at").unwrap_or_else(|_| chrono::Utc::now());
    let maybe_deleted_at: Option<chrono::DateTime<chrono::Utc>> = row.try_get("maybe_deleted_at").ok().flatten();
    let total_spend: f64 = row.try_get("total_spend").unwrap_or(0.0);

    result.push(DeveloperApiKeyInfo {
      token: row.try_get("token").unwrap_or_default(),
      truncated_api_key,
      name: row.try_get("name").unwrap_or_default(),
      maybe_description: row.try_get("maybe_description").ok().flatten(),
      total_spend,
      owner_user_token: row.try_get("owner_user_token").unwrap_or_default(),
      ip_address_creation: row.try_get("ip_address_creation").unwrap_or_default(),
      ip_address_update: row.try_get("ip_address_update").unwrap_or_default(),
      created_at: created_at.to_rfc3339(),
      updated_at: updated_at.to_rfc3339(),
      maybe_deleted_at: maybe_deleted_at.map(|d| d.to_rfc3339()),
    });
  }

  Ok(result)
}

/// Get the cumulative amount already synced and billed for a user across their developer keys.
pub async fn get_total_synced_spend_for_user(
  conn: &mut MySqlConnection,
  owner_user_token: &str,
) -> Result<f64, sqlx::Error> {
  ensure_developer_api_keys_table(conn).await?;

  let row = sqlx::query(
    r#"
SELECT COALESCE(SUM(last_synced_spend), 0.0) as total_synced
FROM developer_api_keys
WHERE owner_user_token = ?
    "#,
  )
  .bind(owner_user_token)
  .fetch_one(&mut *conn)
  .await?;

  let total: f64 = row.try_get("total_synced").unwrap_or(0.0);
  Ok(total)
}

/// Record newly billed spend on the user's most recent active developer key.
pub async fn record_spend_sync_on_latest_key(
  conn: &mut MySqlConnection,
  owner_user_token: &str,
  newly_billed_spend: f64,
) -> Result<(), sqlx::Error> {
  ensure_developer_api_keys_table(conn).await?;

  sqlx::query(
    r#"
UPDATE developer_api_keys
SET last_synced_spend = last_synced_spend + ?
WHERE owner_user_token = ? AND maybe_deleted_at IS NULL
ORDER BY id DESC
LIMIT 1
    "#,
  )
  .bind(newly_billed_spend)
  .bind(owner_user_token)
  .execute(&mut *conn)
  .await?;

  Ok(())
}

/// Update total spend for a specific key.
pub async fn update_key_spend(
  conn: &mut MySqlConnection,
  token: &str,
  total_spend: f64,
) -> Result<(), sqlx::Error> {
  ensure_developer_api_keys_table(conn).await?;

  sqlx::query(
    r#"
UPDATE developer_api_keys
SET total_spend = ?
WHERE token = ?
    "#,
  )
  .bind(total_spend)
  .bind(token)
  .execute(&mut *conn)
  .await?;

  Ok(())
}

/// List active key tokens and full secrets for spend polling.
pub async fn list_active_keys_with_secrets(
  conn: &mut MySqlConnection,
  owner_user_token: &str,
) -> Result<Vec<(String, String)>, sqlx::Error> {
  ensure_developer_api_keys_table(conn).await?;

  let rows = sqlx::query(
    r#"
SELECT token, api_key
FROM developer_api_keys
WHERE owner_user_token = ? AND maybe_deleted_at IS NULL
    "#,
  )
  .bind(owner_user_token)
  .fetch_all(&mut *conn)
  .await?;

  let result = rows
    .into_iter()
    .map(|r| {
      (
        r.try_get::<String, _>("token").unwrap_or_default(),
        r.try_get::<String, _>("api_key").unwrap_or_default(),
      )
    })
    .collect();

  Ok(result)
}

/// Soft-delete a developer API key.
pub async fn delete_developer_key(
  conn: &mut MySqlConnection,
  token: &str,
  owner_user_token: &str,
) -> Result<bool, sqlx::Error> {
  ensure_developer_api_keys_table(conn).await?;

  let result = sqlx::query(
    r#"
UPDATE developer_api_keys
SET maybe_deleted_at = NOW()
WHERE token = ? AND owner_user_token = ? AND maybe_deleted_at IS NULL
    "#,
  )
  .bind(token)
  .bind(owner_user_token)
  .execute(&mut *conn)
  .await?;

  Ok(result.rows_affected() > 0)
}

/// Look up user token for an active developer API key.
pub async fn get_user_token_by_developer_key(
  conn: &mut MySqlConnection,
  api_key_value: &str,
) -> Result<Option<String>, sqlx::Error> {
  ensure_developer_api_keys_table(conn).await?;

  let maybe_row = sqlx::query(
    r#"
SELECT owner_user_token
FROM developer_api_keys
WHERE api_key = ? AND maybe_deleted_at IS NULL
LIMIT 1
    "#,
  )
  .bind(api_key_value)
  .fetch_optional(&mut *conn)
  .await?;

  Ok(maybe_row.and_then(|r| r.try_get::<String, _>("owner_user_token").ok()))
}

/// Look up user token and key token for an active developer API key.
pub async fn get_user_and_token_by_developer_key(
  conn: &mut MySqlConnection,
  api_key_value: &str,
) -> Result<Option<(String, String)>, sqlx::Error> {
  ensure_developer_api_keys_table(conn).await?;

  let maybe_row = sqlx::query(
    r#"
SELECT owner_user_token, token
FROM developer_api_keys
WHERE api_key = ? AND maybe_deleted_at IS NULL
LIMIT 1
    "#,
  )
  .bind(api_key_value)
  .fetch_optional(&mut *conn)
  .await?;

  Ok(maybe_row.and_then(|r| {
    let u: String = r.try_get("owner_user_token").ok()?;
    let t: String = r.try_get("token").ok()?;
    Some((u, t))
  }))
}

/// Atomically increment spend for a specific key.
pub async fn increment_key_spend(
  conn: &mut MySqlConnection,
  token: &str,
  credits_spent: f64,
) -> Result<(), sqlx::Error> {
  ensure_developer_api_keys_table(conn).await?;

  sqlx::query(
    r#"
UPDATE developer_api_keys
SET total_spend = total_spend + ?
WHERE token = ?
    "#,
  )
  .bind(credits_spent)
  .bind(token)
  .execute(&mut *conn)
  .await?;

  Ok(())
}

/// Look up the full api_key for a given token and owner (used for deleting from upstream LiteLLM).
pub async fn get_developer_key_by_token(
  conn: &mut MySqlConnection,
  token: &str,
  owner_user_token: &str,
) -> Result<Option<String>, sqlx::Error> {
  ensure_developer_api_keys_table(conn).await?;

  let maybe_row = sqlx::query(
    r#"
SELECT api_key
FROM developer_api_keys
WHERE token = ? AND owner_user_token = ? AND maybe_deleted_at IS NULL
LIMIT 1
    "#,
  )
  .bind(token)
  .bind(owner_user_token)
  .fetch_optional(&mut *conn)
  .await?;

  Ok(maybe_row.and_then(|r| r.try_get::<String, _>("api_key").ok()))
}

