export interface User {
  id: string;
  email: string;
  name: string;
  rank: string | null;
  position: string | null;
  military_class: number | null;
  test_class: boolean | null;
  coefficient: number | null;
  availability: string | null;
  sort_order: number | null;
}

export interface AircraftType {
  id: number;
  name: string;
}

export interface MuBreakDate {
  id: string;
  user_id: string;
  aircraft_type_id: number;
  mu_condition: string;
  last_date: string;
}

export interface LpBreakDate {
  id: string;
  user_id: string;
  lp_type: string;
  last_date: string;
}

export interface BreakPeriodMu {
  id: string;
  mu_condition: string;
  military_class: number;
  days: number;
}

export interface BreakPeriodLp {
  id: string;
  lp_type: string;
  military_class: number;
  months: number;
  kbp_document: string | null;
  lp_type_normalized: string | null;
}

export interface CommissionDate {
  id: string;
  user_id: string;
  commission_type_id: string;
  commission_date: string;
  expiry_date: string | null;
  commission_types?: {
    name: string;
    days: number;
  };
}

export interface CommissionDateAircraft {
  id: string;
  user_id: string;
  aircraft_type_id: number;
  commission_type_id: string;
  commission_date: string;
  expiry_date: string | null;
}

export interface AnnualCheck {
  id: string;
  user_id: string;
  check_type: string;
  check_date: string;
  expiry_date: string | null;
  months_valid: number;
}

export interface Flight {
  id: string;
  user_id: string;
  date: string;
  aircraft_type_id: number | null;
  time_of_day: string;
  weather_conditions: string;
  flight_type: string;
  flight_time: string | null;
  combat_applications: number | null;
  flights_count: number | null;
}

export interface UserAircraft {
  aircraft_type_id: number;
}

export interface AircraftKbpMapping {
  aircraft_type_id: number;
  kbp_document: string;
  is_primary: boolean | null;
}

export type StatusColor = 'green' | 'yellow' | 'red' | 'gray';

export interface StatusItem {
  aircraft?: string;
  date: string;
  expiryDate: string;
  color: StatusColor;
}

export interface CommissionLlkUmo {
  llk: { date: string; color: StatusColor } | null;
  umo: { date: string; color: StatusColor } | null;
  nextType: string | null;
  nextDate: string;
  nextColor: StatusColor;
}

export interface PilotDashboardData {
  user: User;
  aircraftNames: string[];
  mu: Record<string, StatusItem[]>;
  lp: Record<string, StatusItem[]>;
  lpTypes: string[];
  commission: Record<string, CommissionLlkUmo | StatusItem[]>;
  annualChecks: { check_type: string; date: string; color: StatusColor }[];
  flightHours: FlightHourRow[];
}

export interface FlightHourRow {
  aircraftName: string;
  flightsCount: number;
  totalMinutes: number;
  combatTotal: number;
}

export interface PilotSummary {
  user: User;
  aircraftNames: string[];
  muStatuses: StatusColor[];
  lpStatuses: StatusColor[];
  commissionStatuses: StatusColor[];
  annualStatuses: StatusColor[];
  overallStatus: StatusColor;
}
