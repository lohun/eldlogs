import React, { useState, useReducer, useRef, useEffect } from 'react';

// API Types based on your Django backend
interface LocationCoordinate {
  lat: number;
  lng: number;
}

interface LocationWithAddress extends LocationCoordinate {
  address?: string;
}

interface DriverInfo {
  id: number;
  full_name: string;
  license_number: string;
  current_cycle_hours: number;
}

interface RestStop {
  id: number;
  stop_type: 'break' | 'rest' | 'fuel';
  location: LocationWithAddress;
  scheduled_arrival: string;
  duration_hours: number;
  distance_from_start_miles: number;
  is_mandatory: boolean;
  hos_reason: string;
  created_at: string;
  trip: number;
}

interface ELDLog {
  id: number;
  log_date: string;
  duty_status: 'on_duty' | 'driving' | 'off_duty' | 'sleeper_berth';
  start_time: string;
  end_time: string;
  duration_hours: number;
  location: LocationWithAddress | null;
  remarks: string;
  created_at: string;
  updated_at: string;
  trip: number;
  driver: number;
}

interface Coordinates {
  results: LocationCoordinate
}


interface TripResponse {
  id: number;
  driver: number;
  driver_info: DriverInfo;
  status: string;
  current_location: LocationCoordinate;
  pickup_location: LocationCoordinate;
  dropoff_location: LocationCoordinate;
  total_distance_miles: number;
  estimated_drive_time_hours: number;
  current_cycle_used_hours: number;
  route_coordinates: [number, number][];
  waypoints: any;
  rest_stops: RestStop[];
  eld_logs: ELDLog[];
  created_at: string;
  trip_start_time: string | null;
  trip_end_time: string | null;
  requires_multiple_days: boolean;
}

interface TripRequest {
  current_location: LocationCoordinate;
  pickup_location: LocationCoordinate;
  dropoff_location: LocationCoordinate;
  current_cycle_used_hours: number;
}

// App State Types
interface AppState {
  currentLocation: LocationCoordinate | null;
  pickupLocation: LocationCoordinate | null;
  dropoffLocation: LocationCoordinate | null;
  currentCycleHours: number;
  tripData: TripResponse | null;
  isCalculating: boolean;
  error: string | null;
}

type AppAction =
  | { type: 'SET_CURRENT_LOCATION'; payload: LocationCoordinate }
  | { type: 'SET_PICKUP_LOCATION'; payload: LocationCoordinate }
  | { type: 'SET_DROPOFF_LOCATION'; payload: LocationCoordinate }
  | { type: 'SET_CYCLE_HOURS'; payload: number }
  | { type: 'SET_CALCULATING'; payload: boolean }
  | { type: 'SET_TRIP_DATA'; payload: TripResponse }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_CURRENT_LOCATION':
      return { ...state, currentLocation: action.payload };
    case 'SET_PICKUP_LOCATION':
      return { ...state, pickupLocation: action.payload };
    case 'SET_DROPOFF_LOCATION':
      return { ...state, dropoffLocation: action.payload };
    case 'SET_CYCLE_HOURS':
      return { ...state, currentCycleHours: action.payload };
    case 'SET_CALCULATING':
      return { ...state, isCalculating: action.payload };
    case 'SET_TRIP_DATA':
      return { ...state, tripData: action.payload, isCalculating: false };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isCalculating: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
};

// API Service
class TripAPIService {
  private static readonly BASE_URL = 'http://127.0.0.1:8000/api/trips/';

  static async createTrip(tripData: TripRequest): Promise<TripResponse> {
    console.log(tripData)
    const response = await fetch(this.BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tripData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  static async geocodeAddress(address: string): Promise<Coordinates> {
    const response = await fetch(`${this.BASE_URL}geocode/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: address }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }
}

// Utility Functions
const formatTime = (timeString: string): string => {
  return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};

const getDutyStatusColor = (status: string): string => {
  switch (status) {
    case 'driving': return '#ef4444';
    case 'on_duty': return '#f59e0b';
    case 'off_duty': return '#10b981';
    case 'sleeper_berth': return '#3b82f6';
    default: return '#6b7280';
  }
};

const getDutyStatusLabel = (status: string): string => {
  switch (status) {
    case 'driving': return 'Driving';
    case 'on_duty': return 'On Duty (Not Driving)';
    case 'off_duty': return 'Off Duty';
    case 'sleeper_berth': return 'Sleeper Berth';
    default: return status;
  }
};

// Components
const LocationInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  onLocationSet: (location: LocationCoordinate) => void;
  isSet: boolean;
}> = ({ label, value, onChange, onLocationSet, isSet }) => {
  const handleSetLocation = async () => {
    // Parse coordinate input (lat, lng)
    const coordinates = await TripAPIService.geocodeAddress(value);

    if (!coordinates.results) {
      alert("Address not found please check your address and try again");
      return
    }
    const { lat, lng } = coordinates.results;
    onLocationSet({ lat: lat, lng: lng });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSetLocation();
    }
  };

  return (
    <div className="mb-4">
      <div className="block text-sm font-medium text-gray-700 mb-1">
        {label} {isSet && <span className="text-green-600">✓</span>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          className={`flex-1 px-3 py-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isSet ? 'border-green-300 bg-green-50' : 'border-gray-300'
            }`}
          placeholder="Full Addresss including number, street, city, state, etc"
        />
        <button
          onClick={handleSetLocation}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Set
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">Enter coordinates as: latitude, longitude</p>
    </div>
  );
};

const TripSummary: React.FC<{ tripData: TripResponse }> = ({ tripData }) => (
  <div className="bg-white text-gray-700 p-6 rounded-lg shadow-md mb-4">
    <h3 className="text-lg font-semibold mb-4">Trip Summary</h3>
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <p className="text-sm text-gray-600">Total Distance</p>
        <p className="text-lg font-medium">{tripData.total_distance_miles.toFixed(0)} miles</p>
      </div>
      <div>
        <p className="text-sm text-gray-600">Drive Time</p>
        <p className="text-lg font-medium">{tripData.estimated_drive_time_hours.toFixed(1)} hours</p>
      </div>
      <div>
        <p className="text-sm text-gray-600">Multiple Days</p>
        <p className="text-lg font-medium">{tripData.requires_multiple_days ? 'Yes' : 'No'}</p>
      </div>
      <div>
        <p className="text-sm text-gray-600">Trip Status</p>
        <p className="text-lg font-medium capitalize">{tripData.status}</p>
      </div>
    </div>

    <div className="mb-4">
      <h4 className="font-medium mb-2">Driver Information</h4>
      <div className="text-sm space-y-1">
        <p><span className="text-gray-600">License:</span> {tripData.driver_info.license_number}</p>
        <p><span className="text-gray-600">Current Cycle Hours:</span> {tripData.driver_info.current_cycle_hours}</p>
      </div>
    </div>

    <div className="mt-4">
      <h4 className="font-medium mb-2">Required Stops ({tripData.rest_stops.length})</h4>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {tripData.rest_stops.map((stop) => (
          <div key={stop.id} className="flex justify-between items-start text-sm border-l-4 border-blue-200 pl-3 py-1">
            <div>
              <div className="font-medium text-gray-800 capitalize">
                {stop.stop_type} {stop.is_mandatory && '(Mandatory)'}
              </div>
              <div className="text-gray-600 text-xs">{stop.hos_reason}</div>
              <div className="text-gray-500 text-xs">
                Mile {stop.distance_from_start_miles.toFixed(0)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium">{stop.duration_hours}h</div>
              <div className="text-xs text-gray-500">
                {new Date(stop.scheduled_arrival).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const MapView: React.FC<{ tripData: TripResponse | null }> = ({ tripData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!tripData || !tripData.route_coordinates.length) {
      ctx.fillStyle = '#64748b';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Calculate trip to see route visualization', canvas.width / 2, canvas.height / 2);
      return;
    }

    const { route_coordinates } = tripData;

    // Find bounds
    const lats = route_coordinates.map(c => c[0]);
    const lngs = route_coordinates.map(c => c[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;
    const padding = 40;

    // Convert lat/lng to canvas coordinates
    const toCanvas = (lat: number, lng: number): [number, number] => {
      const x = padding + ((lng - minLng) / lngRange) * (canvas.width - 2 * padding);
      const y = padding + ((maxLat - lat) / latRange) * (canvas.height - 2 * padding);
      return [x, y];
    };

    // Draw route line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const [startX, startY] = toCanvas(route_coordinates[0][0], route_coordinates[0][1]);
    ctx.moveTo(startX, startY);

    for (let i = 1; i < route_coordinates.length; i++) {
      const [x, y] = toCanvas(route_coordinates[i][0], route_coordinates[i][1]);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw markers
    const drawMarker = (lat: number, lng: number, color: string, label: string) => {
      const [x, y] = toCanvas(lat, lng);

      // Draw marker circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();

      // Draw white center
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Draw label
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 15);
    };

    // Draw start, pickup, and end markers
    drawMarker(tripData.current_location.lat, tripData.current_location.lng, '#10b981', 'Current');
    drawMarker(tripData.pickup_location.lat, tripData.pickup_location.lng, '#f59e0b', 'Pickup');
    drawMarker(tripData.dropoff_location.lat, tripData.dropoff_location.lng, '#ef4444', 'Dropoff');

    // Draw rest stops
    tripData.rest_stops.forEach((stop, index) => {
      if (stop.location.lat && stop.location.lng) {
        drawMarker(stop.location.lat, stop.location.lng, '#8b5cf6', `S${index + 1}`);
      }
    });

  }, [tripData]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Route Map</h3>
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className="w-full h-80 border border-gray-200 rounded"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      <div className="flex justify-center space-x-6 mt-2 text-sm">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-1"></div>
          <span className='text-gray-700'>Current</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-yellow-500 rounded-full mr-1"></div>
          <span className='text-gray-700'>Pickup</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded-full mr-1"></div>
          <span className='text-gray-700'>Dropoff</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-purple-500 rounded-full mr-1"></div>
          <span className='text-gray-700'>Rest Stop</span>
        </div>
      </div>
    </div>
  );
};

const ELDLogSheet: React.FC<{ tripData: TripResponse; logDate: string }> = ({ tripData, logDate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filter logs for this specific date
  const dailyLogs = tripData.eld_logs

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas
    canvas.width = 800;
    canvas.height = 600;

    // Clear and set background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw log sheet template
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.lineWidth = 1;

    // Title
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ELECTRONIC LOGGING DEVICE (ELD) DAILY LOG', canvas.width / 2, 30);

    // Driver info section
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    const driverInfo = tripData.driver_info;
    ctx.fillText(`Driver: ${driverInfo.full_name || 'N/A'}`, 50, 60);
    ctx.fillText(`License: ${driverInfo.license_number}`, 300, 60);
    ctx.fillText(`Date: ${formatDate(logDate)}`, 550, 60);
    ctx.fillText(`Trip ID: ${tripData.id}`, 50, 80);

    // Grid for 24-hour log
    const gridY = 110;
    const gridHeight = 300;
    const gridWidth = 700;
    const startX = 50;

    // Draw grid lines
    ctx.beginPath();
    // Horizontal lines for duty status
    for (let i = 0; i <= 4; i++) {
      const y = gridY + (i * gridHeight / 4);
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + gridWidth, y);
    }
    // Vertical lines (hours)
    for (let i = 0; i <= 24; i++) {
      const x = startX + (i * gridWidth / 24);
      ctx.moveTo(x, gridY);
      ctx.lineTo(x, gridY + gridHeight);
    }
    ctx.stroke();

    // Duty status labels
    const statusLabels = ['Off Duty', 'Sleeper Berth', 'Driving', 'On Duty (Not Driving)'];
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    for (let i = 0; i < 4; i++) {
      const y = gridY + (i * gridHeight / 4) + (gridHeight / 8);
      ctx.fillText(statusLabels[i], startX - 10, y + 3);
    }

    // Hour labels
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 24; i++) {
      const x = startX + (i * gridWidth / 24);
      ctx.fillText(i.toString().padStart(2, '0'), x, gridY - 5);
    }

    // Draw duty status lines based on ELD logs
    dailyLogs.forEach((log) => {
      const startHour = parseFloat(log.start_time.split(':')[0]) + parseFloat(log.start_time.split(':')[1]) / 60;
      const endHour = parseFloat(log.end_time.split(':')[0]) + parseFloat(log.end_time.split(':')[1]) / 60;

      let statusRow = 0;
      switch (log.duty_status) {
        case 'off_duty': statusRow = 0; break;
        case 'sleeper_berth': statusRow = 1; break;
        case 'driving': statusRow = 2; break;
        case 'on_duty': statusRow = 3; break;
      }

      const y = gridY + (statusRow * gridHeight / 4) + (gridHeight / 8);
      const startX_line = startX + (startHour / 24) * gridWidth;
      const endX_line = startX + (endHour / 24) * gridWidth;

      ctx.strokeStyle = getDutyStatusColor(log.duty_status);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startX_line, y);
      ctx.lineTo(endX_line, y);
      ctx.stroke();

      // Add time labels
      ctx.fillStyle = '#000';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(formatTime(log.start_time), startX_line, y - 5);
      if (endX_line - startX_line > 30) {
        ctx.fillText(formatTime(log.end_time), endX_line, y - 5);
      }
    });

    // Calculate totals
    const totals = {
      off_duty: 0,
      sleeper_berth: 0,
      driving: 0,
      on_duty: 0
    };

    dailyLogs.forEach(log => {
      totals[log.duty_status as keyof typeof totals] += log.duration_hours;
    });

    // Totals section
    const totalsY = gridY + gridHeight + 30;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';

    ctx.fillText('TOTALS:', 50, totalsY);
    ctx.fillText(`Off Duty: ${totals.off_duty.toFixed(1)} hrs`, 50, totalsY + 20);
    ctx.fillText(`Sleeper Berth: ${totals.sleeper_berth.toFixed(1)} hrs`, 200, totalsY + 20);
    ctx.fillText(`Driving: ${totals.driving.toFixed(1)} hrs`, 350, totalsY + 20);
    ctx.fillText(`On Duty: ${totals.on_duty.toFixed(1)} hrs`, 500, totalsY + 20);

    // Remarks section
    ctx.fillText('REMARKS:', 50, totalsY + 50);
    let remarkY = totalsY + 70;
    dailyLogs.forEach((log, _) => {
      if (log.remarks && remarkY < canvas.height - 30) {
        ctx.font = '10px Arial';
        ctx.fillText(`${formatTime(log.start_time)}: ${log.remarks}`, 50, remarkY);
        remarkY += 15;
      }
    });

    // Signature line
    ctx.font = '12px Arial';
    ctx.fillText('Driver Signature: _________________________', 50, canvas.height - 40);
    ctx.fillText(`Date: ${formatDate(logDate)}`, 400, canvas.height - 40);

    // Reset context
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#000';

  }, [tripData, logDate, dailyLogs]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-4">
      <h4 className="text-lg font-semibold mb-4">
        ELD Log Sheet - {formatDate(logDate)}
        <span className="text-sm text-gray-500 ml-2">({dailyLogs.length} entries)</span>
      </h4>
      <canvas
        ref={canvasRef}
        className="w-full border border-gray-300"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      <div className="mt-2 text-sm text-gray-600">
        <p>This log sheet is automatically generated from the API response and shows actual HOS-compliant duty status changes.</p>
      </div>
    </div>
  );
};

// Main App Component
const ELDTripPlanner: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, {
    currentLocation: null,
    pickupLocation: null,
    dropoffLocation: null,
    currentCycleHours: 7,
    tripData: null,
    isCalculating: false,
    error: null
  });

  const [currentLocationInput, setCurrentLocationInput] = useState('Lagos, Nigeria');
  const [pickupLocationInput, setPickupLocationInput] = useState('Ibadan, Nigeria');
  const [dropoffLocationInput, setDropoffLocationInput] = useState('Abuja, Nigeria');
  const [showLogSheets, setShowLogSheets] = useState(false);

  const calculateTrip = async () => {
    const { currentLocation, pickupLocation, dropoffLocation, currentCycleHours } = state;

    if (!currentLocation || !pickupLocation || !dropoffLocation) {
      dispatch({ type: 'SET_ERROR', payload: 'Please set all location coordinates before calculating trip' });
      return;
    }

    dispatch({ type: 'SET_CALCULATING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      const tripRequest: TripRequest = {
        current_location: currentLocation,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        current_cycle_used_hours: currentCycleHours
      };


      const tripResponse = await TripAPIService.createTrip(tripRequest);
      dispatch({ type: 'SET_TRIP_DATA', payload: tripResponse });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to calculate trip. Please check your connection and try again.';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  };

  // Get unique log dates for multiple log sheets
  const getUniqueDates = (): string[] => {
    if (!state.tripData) return [];
    const dates = state.tripData.eld_logs.map(log => log.log_date);
    return [...new Set(dates)].sort();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">ELD Trip Planner</h1>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Input Panel */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-6">Trip Details</h2>

            <LocationInput
              label="Current Location"
              value={currentLocationInput}
              onChange={setCurrentLocationInput}
              onLocationSet={(location) => dispatch({ type: 'SET_CURRENT_LOCATION', payload: location })}
              isSet={!!state.currentLocation}
            />

            <LocationInput
              label="Pickup Location"
              value={pickupLocationInput}
              onChange={setPickupLocationInput}
              onLocationSet={(location) => dispatch({ type: 'SET_PICKUP_LOCATION', payload: location })}
              isSet={!!state.pickupLocation}
            />

            <LocationInput
              label="Dropoff Location"
              value={dropoffLocationInput}
              onChange={setDropoffLocationInput}
              onLocationSet={(location) => dispatch({ type: 'SET_DROPOFF_LOCATION', payload: location })}
              isSet={!!state.dropoffLocation}
            />

            <div className="mb-6">
              <div className="block text-sm font-medium text-gray-700 mb-1">
                Current 70-Hour Cycle Used (Hours)
              </div>
              <input
                type="number"
                min="0"
                max="70"
                step="0.5"
                value={state.currentCycleHours}
                onChange={(e) => dispatch({ type: 'SET_CYCLE_HOURS', payload: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border text-gray-700 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Enter hours already used in current 8-day cycle (0-70)</p>
            </div>

            {state.error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                <div className="font-medium">Error:</div>
                <div className="text-sm">{state.error}</div>
              </div>
            )}

            <button
              onClick={calculateTrip}
              disabled={state.isCalculating}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {state.isCalculating ? 'Calculating Trip...' : 'Calculate HOS-Compliant Trip'}
            </button>

            {state.tripData && (
              <button
                onClick={() => setShowLogSheets(!showLogSheets)}
                className="w-full mt-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {showLogSheets ? 'Hide' : 'Show'} ELD Log Sheets ({getUniqueDates().length} days)
              </button>
            )}

            {/* API Status */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="text-sm text-blue-800">
                <div className="font-medium">API Endpoint:</div>
                <div className="text-xs font-mono">POST http://127.0.0.1:8000/api/trips/</div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="xl:col-span-2 space-y-6">
            {state.tripData && <TripSummary tripData={state.tripData} />}
            <MapView tripData={state.tripData} />

            {/* ELD Logs Timeline */}
            {state.tripData && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4">HOS Timeline</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {state.tripData.eld_logs.map((log) => (
                    <div key={log.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getDutyStatusColor(log.duty_status) }}
                      ></div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-sm">
                              {getDutyStatusLabel(log.duty_status)}
                            </div>
                            <div className="text-xs text-gray-600">{log.remarks}</div>
                          </div>
                          <div className="text-right text-sm">
                            <div>{formatDate(log.log_date)}</div>
                            <div className="text-xs text-gray-500">
                              {formatTime(log.start_time)} - {formatTime(log.end_time)}
                            </div>
                            <div className="text-xs font-medium">
                              {log.duration_hours.toFixed(1)}h
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Log Sheets */}
            {showLogSheets && state.tripData && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Generated ELD Log Sheets</h3>
                {getUniqueDates().map((date, _) => (
                  <ELDLogSheet key={date} tripData={state.tripData!} logDate={date} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-blue-900">How to Use</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="bg-white p-4 rounded">
              <h4 className="font-medium text-blue-800 mb-2">📍 Set Coordinates</h4>
              <p className="text-gray-600">Enter latitude and longitude coordinates for current location, pickup, and dropoff points.</p>
            </div>
            <div className="bg-white p-4 rounded">
              <h4 className="font-medium text-blue-800 mb-2">⏱️ Cycle Hours</h4>
              <p className="text-gray-600">Enter the number of hours already used in the current 70-hour/8-day cycle.</p>
            </div>
            <div className="bg-white p-4 rounded">
              <h4 className="font-medium text-blue-800 mb-2">🚛 Calculate Trip</h4>
              <p className="text-gray-600">The API calculates HOS-compliant routes with mandatory breaks and rest periods.</p>
            </div>
            <div className="bg-white p-4 rounded">
              <h4 className="font-medium text-blue-800 mb-2">📋 View Logs</h4>
              <p className="text-gray-600">Review generated ELD log sheets with proper DOT formatting and duty status tracking.</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-yellow-100 border border-yellow-300 rounded">
            <h4 className="font-medium text-yellow-800 mb-2">📖 Sample</h4>
            <div className="text-sm text-yellow-700 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div><strong>Current:</strong> Lagos, Nigeria</div>
              <div><strong>Pickup:</strong> Ibadan, Nigeria</div>
              <div><strong>Dropoff:</strong> Abuja, Nigeria</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Real-time HOS compliance calculations</p>
        </div>
      </div>
    </div>
  );
};

export default ELDTripPlanner;