const { supabaseAdmin } = require('../config/db');

async function initGeofence() {
  const entries = [
    { config_key: 'college_latitude', config_value: '19.02479', description: 'College GPS Latitude' },
    { config_key: 'college_longitude', config_value: '73.10159', description: 'College GPS Longitude' },
    { config_key: 'geofence_radius_meters', config_value: '100', description: 'Allowed attendance radius in meters' },
  ];

  for (const item of entries) {
    const { data, error } = await supabaseAdmin
      .from('system_config')
      .upsert(
        {
          config_key: item.config_key,
          config_value: item.config_value,
          description: item.description,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'config_key' }
      )
      .select();

    if (error) {
      console.error('Error on', item.config_key, error.message);
    } else {
      console.log('Saved:', item.config_key, '=', data[0]?.config_value);
    }
  }

  process.exit(0);
}

initGeofence().catch((err) => {
  console.error(err);
  process.exit(1);
});
