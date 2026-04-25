CREATE DATABASE IF NOT EXISTS kickmap_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kickmap_db;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS email_logs;
DROP TABLE IF EXISTS message_receipts;
DROP TABLE IF EXISTS friend_requests;
DROP TABLE IF EXISTS user_rewards;
DROP TABLE IF EXISTS user_achievements;
DROP TABLE IF EXISTS task_completions;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS chat_members;
DROP TABLE IF EXISTS chats;
DROP TABLE IF EXISTS rewards;
DROP TABLE IF EXISTS achievements;
DROP TABLE IF EXISTS user_points;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_data LONGBLOB NULL,
  avatar_mime VARCHAR(120) NULL,
  is_online TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_seen DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_users_email ON users(email);

CREATE TABLE user_points (
  user_id INT UNSIGNED PRIMARY KEY,
  total_points INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_points_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE chats (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type ENUM('private', 'group') NOT NULL,
  name VARCHAR(150) NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chats_creator
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_chats_type ON chats(type);
CREATE INDEX idx_chats_created_by ON chats(created_by);

CREATE TABLE chat_members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  chat_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_chat_user (chat_id, user_id),
  CONSTRAINT fk_chat_members_chat
    FOREIGN KEY (chat_id) REFERENCES chats(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_chat_members_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_chat_members_user ON chat_members(user_id);

CREATE TABLE messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  chat_id INT UNSIGNED NOT NULL,
  sender_id INT UNSIGNED NOT NULL,
  content TEXT NULL,
  message_type ENUM('text', 'image', 'video', 'audio', 'file', 'location', 'system') NOT NULL DEFAULT 'text',
  file_data LONGBLOB NULL,
  file_name VARCHAR(255) NULL,
  file_mime VARCHAR(120) NULL,
  file_size INT UNSIGNED NULL,
  location_url VARCHAR(2048) NULL,
  is_encrypted TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_chat
    FOREIGN KEY (chat_id) REFERENCES chats(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender
    FOREIGN KEY (sender_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  INDEX idx_messages_chat_created (chat_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE message_receipts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  delivered_at DATETIME NULL,
  read_at DATETIME NULL,
  UNIQUE KEY uk_message_user (message_id, user_id),
  CONSTRAINT fk_message_receipts_message
    FOREIGN KEY (message_id) REFERENCES messages(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_message_receipts_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE friend_requests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  requester_id INT UNSIGNED NOT NULL,
  receiver_id INT UNSIGNED NOT NULL,
  status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  CONSTRAINT fk_friend_requests_requester
    FOREIGN KEY (requester_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_friend_requests_receiver
    FOREIGN KEY (receiver_id) REFERENCES users(id)
    ON DELETE CASCADE,
  INDEX idx_friend_requests_requester (requester_id),
  INDEX idx_friend_requests_receiver (receiver_id)
) ENGINE=InnoDB;

CREATE TABLE tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  chat_id INT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  created_by INT UNSIGNED NOT NULL,
  points INT NOT NULL DEFAULT 10,
  location_url VARCHAR(2048) NULL,
  status ENUM('pending', 'done') NOT NULL DEFAULT 'pending',
  due_date DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  CONSTRAINT fk_tasks_chat
    FOREIGN KEY (chat_id) REFERENCES chats(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tasks_creator
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_tasks_chat ON tasks(chat_id);
CREATE INDEX idx_tasks_status ON tasks(status);

CREATE TABLE task_completions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_task_user (task_id, user_id),
  CONSTRAINT fk_task_completions_task
    FOREIGN KEY (task_id) REFERENCES tasks(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_task_completions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE achievements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(140) NOT NULL,
  description TEXT NULL,
  points_reward INT NOT NULL DEFAULT 3,
  is_active TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE user_achievements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  achievement_id INT UNSIGNED NOT NULL,
  unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_achievement (user_id, achievement_id),
  CONSTRAINT fk_user_achievements_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_achievements_achievement
    FOREIGN KEY (achievement_id) REFERENCES achievements(id)
    ON DELETE CASCADE,
  INDEX idx_user_achievements_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE rewards (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  description TEXT NULL,
  points_cost INT NOT NULL,
  image_data LONGBLOB NULL,
  image_mime VARCHAR(120) NULL,
  is_active TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE user_rewards (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  reward_id INT UNSIGNED NOT NULL,
  redeemed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_reward (user_id, reward_id),
  CONSTRAINT fk_user_rewards_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_rewards_reward
    FOREIGN KEY (reward_id) REFERENCES rewards(id)
    ON DELETE CASCADE,
  INDEX idx_user_rewards_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE email_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  subject VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  status ENUM('sent', 'failed') NOT NULL,
  error_message TEXT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO achievements (key_name, title, description, points_reward)
VALUES
  ('first_friend_request_sent', 'Amigos?', 'Envía tu primer solicitud de amigo a alguien', 3),
  ('first_friend_request_accepted', 'Amigos!', 'Acepta tu primera solicitud de amigos', 3),
  ('first_private_message', 'Primer Contacto!', 'Envía tu primer mensaje privado a un amigo', 3),
  ('first_group_created', 'Líder', 'Crea un chat grupal por primera vez', 3),
  ('first_multimedia_message', 'Multimedia', 'Envía una foto o video a un chat privado o grupal por primera vez', 3),
  ('first_task_created', 'Hay tarea?', 'Agrega tu primera tarea en un chat grupal', 3),
  ('first_task_completed', 'Responsable', 'Realiza tu primera tarea grupal', 3),
  ('first_avatar_change', 'Cambio de look', 'Cambia tu foto de perfil por una nueva', 3);
