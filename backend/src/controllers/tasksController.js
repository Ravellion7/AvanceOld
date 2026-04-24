const { createTask, getTasksByGroup, completeTask } = require(`../models/tasksModel`);
const {
  awardFirstTaskCreated,
  awardFirstTaskCompleted,
} = require(`../models/achievementsModel`);

async function create(req, res) {
  try {
    const createdBy = Number(req.user.id);
    const { chatId, title, description, points, dueDate, locationUrl } = req.body;

    if (!chatId || !title) {
      return res.status(400).json({ message: `chatId y title son requeridos` });
    }

    const task = await createTask({
      chatId: Number(chatId),
      title,
      description: description || null,
      createdBy,
      points: points || 10,
      dueDate: dueDate || null,
      locationUrl: locationUrl || null,
    });

    await awardFirstTaskCreated(createdBy).catch(() => null);

    return res.status(201).json(task);
  } catch (error) {
    return res.status(500).json({ message: `Error al crear tarea`, error: error.message });
  }
}

async function listByGroup(req, res) {
  try {
    const groupId = Number(req.params.groupId);
    const tasks = await getTasksByGroup(groupId);
    return res.json(tasks);
  } catch (error) {
    return res.status(500).json({ message: `Error al obtener tareas`, error: error.message });
  }
}

async function complete(req, res) {
  try {
    const userId = Number(req.user.id);
    const taskId = Number(req.params.id);

    const result = await completeTask({ taskId, userId });
    await awardFirstTaskCompleted(userId).catch(() => null);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  create,
  listByGroup,
  complete,
};
