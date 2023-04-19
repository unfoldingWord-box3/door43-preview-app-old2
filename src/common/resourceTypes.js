/**
 * Resource types and their names:
   For scripture:
    - Translation Notes (tn)
    - Translation Academy (ta)
    - Translation Words (tw)
    - Translation Words List (twl)
    - Translation Questions (tq)
    - Study Notes (sn)
    - Study Questions( sq)
    - Literal Translation (glt)
    - Simplified Translation (gst)

  For Open Bible Stories:
    - OBS (obs)
    - OBS Translation Notes (obs_tn)
    - OBS Study Questions (obs_sq)
    - OBS Study Notes (obs_sn)

 */

export const scriptureResourceTypes = {
    tn: 'Translation Notes',
    ta: 'Translation Academy',
    tw: 'Translation Words',
    twl: 'Translation Words List',
    tq: 'Translation Questions',
    sn: 'Study Notes',
    sq: 'Study Questions',
    glt: 'Literal Translation',
    gst: 'Simplified Translation',
}

export const obsResourceTypes = {
    obs: 'Open Bible Stories',
    obs_sn: 'OBS Study Notes',
    obs_sq: 'OBS Study Questions',
    obs_tn: 'OBS Translation Notes',
}

export const scriptureResourceTypeIds = Object.keys(scriptureResourceTypes);
export const obsResourceTypeIds = Object.keys(obsResourceTypes);

export const allResourceTypeIds = {
  ...scriptureResourceTypeIds,
  ...obsResourceTypeIds,
}

export const allResourceTypes = { 
    ...scriptureResourceTypes,
    ...obsResourceTypes
}