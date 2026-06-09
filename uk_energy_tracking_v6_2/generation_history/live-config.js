window.V62GenerationHistoryConfig={
  role:'backup mirror for Generation History V6',
  workingReference:'/uk_energy_tracking_v6/generation_history/',
  backupRoute:'/uk_energy_tracking_v6_2/generation_history/',
  dailyHistory:'/data/confirmed/generation_daily_mw_spine_fuelhh_candidate.json',
  dailyHistoryFallback:'/data/generation/elexon_generation_sources_2016.json',
  recentHalfHourly:'/uk_energy_tracking_v6_2/generation_history/generation_recent_30d_30min.json',
  recentEcg:'/uk_energy_tracking_v6_2/generation_history/generation_ecg_all_technologies_30d_30min_candidate.json',
  annualBase:'/data/generation/elexon_generation_sources_',
  firstYear:2016,
  defaultTechnology:'Wind',
  technologies:['Solar','Wind','Hydro','Gas','Coal','Biomass','Nuclear','Pumped Storage','Imports & Exports','Other']
};