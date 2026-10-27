import { Activity, Team, User, Workout } from '../models/index.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!isRecord(input)) {
    throw Object.assign(new Error('Activity input must be an object'), { status: 400 });
  }

  const { userId, teamId, type, minutes } = input;
  if (
    !isObjectIdString(userId) ||
    !isObjectIdString(teamId) ||
    typeof type !== 'string' ||
    !type.trim() ||
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    throw Object.assign(new Error('Activity input is invalid'), { status: 400 });
  }

  const [user, team] = await Promise.all([
    User.findById(userId).select('_id'),
    Team.findById(teamId).select('_id'),
  ]);
  if (!user || !team) {
    throw Object.assign(new Error('Activity user or team was not found'), { status: 404 });
  }

  return Activity.create({
    user: user._id,
    team: team._id,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!isRecord(input)) {
    throw Object.assign(new Error('Team input must be an object'), { status: 400 });
  }

  const { name, mascot, members = [] } = input;
  if (typeof name !== 'string' || !name.trim() || typeof mascot !== 'string' || !mascot.trim() || !Array.isArray(members)) {
    throw Object.assign(new Error('Team name, mascot, and members are required'), { status: 400 });
  }
  if (!members.every(isObjectIdString)) {
    throw Object.assign(new Error('Team members must be valid user IDs'), { status: 400 });
  }

  const memberIds = [...new Set(members)];
  const users = await User.find({ _id: { $in: memberIds } }).select('_id');
  if (users.length !== memberIds.length) {
    throw Object.assign(new Error('One or more team members were not found'), { status: 404 });
  }

  return Team.create({
    name: name.trim(),
    mascot: mascot.trim(),
    members: users.map((user) => user._id),
  });
}

export async function getLeaderboard() {
  const totals = await Activity.aggregate<{ teamName: string; totalPoints: number }>([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    {
      $lookup: {
        from: Team.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'team',
      },
    },
    { $unwind: '$team' },
    { $sort: { totalPoints: -1, 'team.name': 1 } },
    { $project: { _id: 0, teamName: '$team.name', totalPoints: 1 } },
  ]);
  return totals.map((team, index) => ({ ...team, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).select('_id fitnessGoal');
  if (!user) {
    throw Object.assign(new Error('User was not found'), { status: 404 });
  }

  const activity = await Activity.findOne({ user: user._id }).sort({ occurredAt: -1 }).select('type');
  const activityFocus = activity?.type.trim().toLowerCase();
  let workouts = activityFocus
    ? await Workout.find({ focus: activityFocus }).sort({ title: 1 }).lean()
    : [];
  let reason = activity
    ? `Recommended based on your recent ${activity.type} activity.`
    : `Recommended to support your ${user.fitnessGoal} fitness goal.`;

  if (workouts.length === 0) {
    workouts = await Workout.find({ focus: user.fitnessGoal }).sort({ title: 1 }).lean();
    reason = activity
      ? `Recommended to support your ${user.fitnessGoal} fitness goal and recent ${activity.type} activity.`
      : reason;
  }

  return workouts.map((workout) => ({ ...workout, reason }));
}

export { User };
