// Random, no-repeat project assignment: each team gets a different case
// from the pool until the pool (currently 4 projects) is exhausted, then
// cycles — so games with more teams than projects still get an assignment
// instead of erroring out.
export function assignProjects(teamIds, projects) {
  if (!teamIds.length || !projects.length) return {};

  const shuffled = [...projects].sort(() => Math.random() - 0.5);
  const assignment = {};
  teamIds.forEach((teamId, i) => {
    assignment[teamId] = shuffled[i % shuffled.length].id;
  });
  return assignment;
}
