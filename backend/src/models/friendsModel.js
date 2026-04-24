const { query } = require('../config/db');

async function listFriends(userId) {
  return query(
    `SELECT fr.id AS relation_id,
            u.id,
            u.name,
            u.email,
            u.is_online,
          u.last_seen,
          COALESCE(up.total_points, 0) AS total_points
     FROM friend_requests fr
     INNER JOIN users u
       ON u.id = CASE
           WHEN fr.requester_id = ? THEN fr.receiver_id
           ELSE fr.requester_id
         END
     LEFT JOIN user_points up ON up.user_id = u.id
     WHERE (fr.requester_id = ? OR fr.receiver_id = ?)
       AND fr.status = 'accepted'
     ORDER BY u.name ASC`,
    [userId, userId, userId]
  );
}

async function listPendingRequests(userId) {
  return query(
    `SELECT fr.id,
            fr.requester_id,
            u.name AS requester_name,
            u.email AS requester_email,
            fr.created_at
     FROM friend_requests fr
     INNER JOIN users u ON u.id = fr.requester_id
     WHERE fr.receiver_id = ?
       AND fr.status = 'pending'
     ORDER BY fr.created_at DESC`,
    [userId]
  );
}

async function listDiscoverUsers(userId, term = '', page = 1, pageSize = 5) {
  const likeTerm = `%${term}%`;
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safeSize = Number(pageSize) > 0 ? Number(pageSize) : 5;
  const offset = (safePage - 1) * safeSize;

  const items = await query(
        `SELECT u.id, u.name, u.email, u.is_online,
          COALESCE(up.total_points, 0) AS total_points,
            (
              SELECT fr.status
              FROM friend_requests fr
              WHERE ((fr.requester_id = ? AND fr.receiver_id = u.id)
                  OR (fr.requester_id = u.id AND fr.receiver_id = ?))
              ORDER BY fr.id DESC
              LIMIT 1
            ) AS relation_status,
            (
              SELECT CASE
                       WHEN fr.requester_id = ? THEN 'outgoing'
                       WHEN fr.receiver_id = ? THEN 'incoming'
                       ELSE NULL
                     END
              FROM friend_requests fr
              WHERE ((fr.requester_id = ? AND fr.receiver_id = u.id)
                  OR (fr.requester_id = u.id AND fr.receiver_id = ?))
              ORDER BY fr.id DESC
              LIMIT 1
            ) AS relation_direction
     FROM users u
     LEFT JOIN user_points up ON up.user_id = u.id
     WHERE u.id <> ?
       AND (u.name LIKE ? OR u.email LIKE ?)
       AND NOT EXISTS (
         SELECT 1
         FROM friend_requests fr
         WHERE ((fr.requester_id = ? AND fr.receiver_id = u.id)
             OR (fr.requester_id = u.id AND fr.receiver_id = ?))
           AND fr.status = 'accepted'
       )
     ORDER BY u.name ASC
     LIMIT ${safeSize} OFFSET ${offset}`,
    [userId, userId, userId, userId, userId, userId, userId, likeTerm, likeTerm, userId, userId]
  );

    const totalRows = await query(
      `SELECT COUNT(*) AS total
       FROM users u
       WHERE u.id <> ?
         AND (u.name LIKE ? OR u.email LIKE ?)
         AND NOT EXISTS (
           SELECT 1
           FROM friend_requests fr
           WHERE ((fr.requester_id = ? AND fr.receiver_id = u.id)
               OR (fr.requester_id = u.id AND fr.receiver_id = ?))
             AND fr.status = 'accepted'
         )`,
      [userId, likeTerm, likeTerm, userId, userId]
  );

    const total = Number(totalRows[0] ? totalRows[0].total : 0);
    return {
      items,
      page: safePage,
      pageSize: safeSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeSize)),
    };
}

async function sendFriendRequest(requesterId, receiverId) {
  if (Number(requesterId) === Number(receiverId)) {
    throw new Error('No puedes agregarte a ti mismo');
  }

  const existing = await query(
    `SELECT id, status, requester_id, receiver_id
     FROM friend_requests
     WHERE (requester_id = ? AND receiver_id = ?)
        OR (requester_id = ? AND receiver_id = ?)
     ORDER BY id DESC
     LIMIT 1`,
    [requesterId, receiverId, receiverId, requesterId]
  );

  if (existing[0]) {
    const row = existing[0];
    if (row.status === 'accepted') {
      throw new Error('Ya son amigos');
    }

    if (row.status === 'pending') {
      throw new Error('Ya existe una solicitud pendiente entre estos usuarios');
    }
  }

  const result = await query(
    `INSERT INTO friend_requests (requester_id, receiver_id, status)
     VALUES (?, ?, 'pending')`,
    [requesterId, receiverId]
  );

  return { id: result.insertId };
}

async function respondRequest({ requestId, userId, accept }) {
  const rows = await query(
    `SELECT id, requester_id, receiver_id, status
     FROM friend_requests
     WHERE id = ?
     LIMIT 1`,
    [requestId]
  );

  const request = rows[0];
  if (!request) {
    throw new Error('Solicitud no encontrada');
  }

  if (Number(request.receiver_id) !== Number(userId)) {
    throw new Error('No puedes responder esta solicitud');
  }

  if (request.status !== 'pending') {
    throw new Error('La solicitud ya fue respondida');
  }

  const nextStatus = accept ? 'accepted' : 'rejected';
  await query(
    `UPDATE friend_requests
     SET status = ?, responded_at = NOW()
     WHERE id = ?`,
    [nextStatus, requestId]
  );

  return {
    status: nextStatus,
    requesterId: Number(request.requester_id),
    receiverId: Number(request.receiver_id),
  };
}

module.exports = {
  listFriends,
  listPendingRequests,
  listDiscoverUsers,
  sendFriendRequest,
  respondRequest,
};
