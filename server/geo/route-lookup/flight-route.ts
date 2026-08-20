import { greatCircleInterpolate, haversineMeters, type LatLon } from '../../domain/clustering/geo-math'
import { findNearestAirportIn, loadAirports, type Airport } from './airports'

export type FlightRouteResult = { geom: LatLon[]; distanceM: number; reason: string }

const MAX_AIRPORT_DISTANCE_KM = 150
const FLIGHT_PATH_SEGMENTS = 48

/**
 * Finds the nearest airport (within 150km) to each endpoint and, if they
 * resolve to two distinct airports, returns a geodesically-correct
 * great-circle route between them. Pure function of an airport list so
 * tests can pass a small fixture instead of the full bundled dataset;
 * findFlightRoute() below is the real entry point using that dataset.
 */
export function findFlightRouteIn(airports: Airport[], from: LatLon, to: LatLon): FlightRouteResult | null {
  const fromAirport = findNearestAirportIn(airports, from, MAX_AIRPORT_DISTANCE_KM)
  const toAirport = findNearestAirportIn(airports, to, MAX_AIRPORT_DISTANCE_KM)
  if (!fromAirport || !toAirport || fromAirport.iata === toAirport.iata) return null

  const geom = greatCircleInterpolate(fromAirport, toAirport, FLIGHT_PATH_SEGMENTS)
  const distanceM = haversineMeters(fromAirport, toAirport)

  return {
    geom,
    distanceM,
    reason: `Snapped to a great-circle route between ${fromAirport.iata} (${fromAirport.name}) and ${toAirport.iata} (${toAirport.name})`
  }
}

/** Local dataset only — no network call. See findFlightRouteIn(). */
export function findFlightRoute(from: LatLon, to: LatLon): FlightRouteResult | null {
  return findFlightRouteIn(loadAirports(), from, to)
}
