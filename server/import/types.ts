export type ActivityType = 'cycling' | 'hiking' | 'running' | 'walking' | 'swimming' | 'other'

export type NormalizedActivityPoint = {
  lat: number
  lon: number
  elevationM: number | null
  time: Date | null
  heartRate: number | null
  cadence: number | null
  power: number | null
}

export type NormalizedActivity = {
  title: string
  type: ActivityType
  points: NormalizedActivityPoint[]
}

export interface ActivityImporter {
  sourceFormat: 'gpx' | 'tcx' | 'fit'
  parse(fileBuffer: Buffer): Promise<NormalizedActivity[]>
}
