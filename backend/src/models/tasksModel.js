const { query } = require(`../config/db`);

async function createTask({ chatId, title, description, createdBy, points = 10, dueDate = null, locationUrl = null }) {
  const result = await query(
    `INSERT INTO tasks (chat_id, title, description, created_by, points, location_url, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [chatId, title, description, createdBy, points, locationUrl, dueDate]
  );

  return {
    id: result.insertId,
    chat_id: chatId,
    title,
    description,
    created_by: createdBy,
    points,
    location_url: locationUrl,
    due_date: dueDate,
  };
}

async function getTasksByGroup(groupId) {
  return query(
    `SELECT t.id, t.chat_id, t.title, t.description, t.created_by, 
            u.name AS creator_name, t.points, t.location_url, t.status, t.due_date, t.created_at, t.completed_at
     FROM tasks t
     INNER JOIN users u ON u.id = t.created_by
     WHERE t.chat_id = ?
     ORDER BY t.status ASC, t.created_at DESC`,
    [groupId]
  );
}

async function completeTask({ taskId, userId }) {
  const taskRows = await query(`SELECT id, points, status FROM tasks WHERE id = ? LIMIT 1`, [taskId]);
  const task = taskRows[0];

  if (!task) {
    throw new Error(`Tarea no encontrada`);
  }

  if (task.status === `done`) {
    return { alreadyDone: true, points: task.points };
  }

  await query(`UPDATE tasks SET status = "done", completed_at = NOW() WHERE id = ?`, [taskId]);
  await query(`INSERT INTO task_completions (task_id, user_id) VALUES (?, ?)`, [taskId, userId]);
  await query(`UPDATE user_points SET total_points = total_points + ? WHERE user_id = ?`, [task.points, userId]);

  return { alreadyDone: false, points: task.points };
}

module.exports = {
  createTask,
  getTasksByGroup,
  completeTask,
};
