// VehicleTable.js - lazily loaded UI for rendering the truck table
import { createLogger } from '../utils/logger.js';

// Initialize logger for this module
const log = createLogger('VehicleTable');

export function formatTruckName(truck) {
  if (truck.name) return truck.name;
  const type = truck.type === 'fiber' ? 'Fiber' : 'Electric';
  const installer = truck.installer || truck.driver || '';
  const shortInstaller = installer.split(' ')[0];
  return `${type} Truck${shortInstaller ? ` (${shortInstaller})` : ''}`;
}

export function getTruckStatus(truck) {
  if (!truck.communication_status || truck.communication_status === 'offline') return 'Offline';
  const isDriving = truck.is_driving || (typeof truck.speed === 'number' && truck.speed > 5);
  return isDriving ? 'Online' : 'Idle';
}

export function formatTruckLocation(truck) {
  if (truck.address) return truck.address;
  if (truck.latitude && truck.longitude) return `${truck.latitude.toFixed(4)}, ${truck.longitude.toFixed(4)}`;
  return 'Location unknown';
}

export async function zoomToTruck(truck) {
  try {
    const mapView = window.mapView;
    if (!mapView || !truck.latitude || !truck.longitude) {
      window.app?.showVehicleNotification?.('Location not available for this vehicle', 'warning');
      return;
    }
    const { default: Point } = await import('@arcgis/core/geometry/Point');
    const point = new Point({ longitude: truck.longitude, latitude: truck.latitude, spatialReference: { wkid: 4326 } });
    await mapView.goTo({ target: point, zoom: 16 });
    const truckName = formatTruckName(truck);
    window.app?.showVehicleNotification?.(`Zoomed to ${truckName}`, 'success');
  } catch (error) {
    log.error('Failed to zoom to truck:', error);
    window.app?.showVehicleNotification?.('Failed to zoom to vehicle location', 'danger');
  }
}

export function populateTruckTable(trucks) {
  log.info('🚛 populateTruckTable called with trucks:', trucks?.length || 0);
  const tbody = document.getElementById('truck-table-body');
  if (!tbody) {
    log.error('🚛 Table body not found!');
    return;
  }

  tbody.innerHTML = '';
  trucks.forEach((truck, index) => {
    try {
      const row = document.createElement('tr');

      const zoomCell = document.createElement('td');
      zoomCell.innerHTML = `
        <calcite-icon 
          icon="zoom-to-object" 
          scale="m" 
          class="truck-zoom-btn"
          title="Zoom to ${truck.name || truck.id}">
        </calcite-icon>
      `;
      const zoomIcon = zoomCell.querySelector('.truck-zoom-btn');
      if (zoomIcon) {
        zoomIcon.addEventListener('click', () => zoomToTruck(truck));
      }

      const nameCell = document.createElement('td');
      nameCell.innerHTML = `
        <div class="truck-name-cell">
          <calcite-icon icon="${truck.typeIcon || (truck.type === 'electric' ? 'flash' : 'car')}" scale="s" class="truck-type-icon"></calcite-icon>
          <span>${formatTruckName(truck)}</span>
        </div>
      `;

      const installerCell = document.createElement('td');
      installerCell.textContent = truck.installer || truck.driver || 'Unknown';

      const statusCell = document.createElement('td');
      const status = getTruckStatus(truck);
      statusCell.innerHTML = `<span class="truck-status-${status.toLowerCase()}">${status}</span>`;

      const locationCell = document.createElement('td');
      locationCell.textContent = formatTruckLocation(truck);

      row.appendChild(zoomCell);
      row.appendChild(nameCell);
      row.appendChild(installerCell);
      row.appendChild(statusCell);
      row.appendChild(locationCell);

      tbody.appendChild(row);
    } catch (error) {
      log.error('🚛 Error creating truck table row:', error);
    }
  });
}


