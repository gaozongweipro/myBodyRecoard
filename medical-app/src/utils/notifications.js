import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async () => {
  const result = await LocalNotifications.requestPermissions();
  return result.display === 'granted';
};

/**
 * Schedule notifications for a medication
 * @param {Object} medication - The medication object
 * @param {number} medication.id - Medication ID (must be integer)
 * @param {string} medication.name - Medication name
 * @param {string} medication.dosage - Dosage (e.g., '1 pill')
 * @param {string[]} medication.times - Array of time strings (e.g., ['08:00', '20:00'])
 * @param {string} medication.startDate - Start date string (YYYY-MM-DD)
 * @param {number} medication.duration - Duration in days
 */
export const scheduleMedicationReminders = async (medication) => {
  // First, verify permission
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.warn('Notification permissions denied');
    return false;
  }

  // Cancel existing notifications for this medication first to avoid duplicates
  await cancelMedicationReminders(medication.id);

  const notifications = [];
  const start = new Date(medication.startDate);
  
  // Base ID logic: medId * 10000 + counter
  // This allows up to 10000 notifications per medication (plenty)
  // And avoids collision between different medications
  const baseId = medication.id * 10000;
  let counter = 0;

  for (let day = 0; day < medication.duration; day++) {
    const date = new Date(start);
    date.setDate(date.getDate() + day);

    // Skip if date is in the past (optional, but good practice. 
    // Capacitor might handle it, but better not to clutter system scheduler)
    // We check if the end of this day is in the past
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    if (endOfDay < new Date()) {
        continue; 
    }

    for (const timeStr of medication.times) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      const scheduleDate = new Date(date);
      scheduleDate.setHours(hours, minutes, 0, 0);

      // Only schedule future times
      if (scheduleDate > new Date()) {
        notifications.push({
          title: '用药提醒',
          body: `该吃药了: ${medication.name} ${medication.dosage || ''}`,
          id: baseId + counter,
          schedule: { at: scheduleDate },
          sound: null, // use default system sound
          attachments: null,
          actionTypeId: '',
          extra: {
            medicationId: medication.id,
            type: 'medication_reminder'
          },
          smallIcon: 'ic_stat_icon_config_sample' // Android resource name if customized, otherwise default
        });
      }
      counter++;
    }
  }

  if (notifications.length > 0) {
    // Schedule in batches to avoid overwhelming the bridge if there are too many
    // Capacitor limit is usually high, but let's be safe
    await LocalNotifications.schedule({ notifications });
    console.log(`Scheduled ${notifications.length} reminders for ${medication.name}`);
  }
  
  return true;
};

/**
 * Cancel all notifications for a specific medication
 * @param {number} medicationId 
 */
export const cancelMedicationReminders = async (medicationId) => {
  // Since we don't know exactly which IDs were used, we can query pending or use the ID range pattern.
  // Querying pending is safer.
  const pending = await LocalNotifications.getPending();
  
  const idsToCancel = pending.notifications
    .filter(n => n.extra && n.extra.medicationId === medicationId)
    .map(n => n.id);

  // Fallback: also try to cancel based on ID range logic if extra data isn't preserved on some platforms
  // (though Capacitor usually preserves extra)
  // Let's rely on pending check first. 
  
  if (idsToCancel.length > 0) {
    await LocalNotifications.cancel({ notifications: idsToCancel.map(id => ({ id })) });
  }
};
