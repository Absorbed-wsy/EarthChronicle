// Bound DOM work independently of the number of records in the library.
export const EVENT_PAGE_SIZE = 40;

export function eventYearGroups(events, min, max) {
  const groups = new Map();
  for (const event of events) {
    const year = Math.max(min, event.year);
    if (year > max || (event.endYear ?? event.year) < min) continue;
    groups.set(year, (groups.get(year) || 0) + 1);
  }
  return [...groups].map(([year,count])=>({year,count})).sort((a,b)=>b.year-a.year);
}

export function timelineStops(groups, min, max, limit = 100) {
  const capacity = Number.isFinite(limit) ? Math.max(1,Math.floor(limit)) : 100;
  const gap = capacity === 1 ? Infinity : Math.max(1,max-min)/(capacity-1);
  const stops = [];
  // Even a small number of years can collide when the visible period is wide.
  // Compare each year's actual axis position with the preceding visible node.
  for (const group of [...groups].sort((a,b)=>b.year-a.year)) {
    const stop = stops.at(-1);
    if (stop && (stop.year-group.year < gap || stops.length >= capacity)) {
      stop.count += group.count;
      stop.first = Math.min(stop.first,group.year);
      stop.last = Math.max(stop.last,group.year);
    } else stops.push({...group,first:group.year,last:group.year});
  }
  return stops;
}
