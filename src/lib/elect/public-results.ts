export type PublicResultsState =
  | "NO_RESULTS"
  | "PARTIAL"
  | "COMPLETE_INTERNAL"
  | "OFFICIAL";

export type PublicAllocationState =
  | "unavailable"
  | "provisional"
  | "complete"
  | "requires_resolution";

export type PublicResultList = {
  ballot_number: number | null;
  name: string;
  party_name: string | null;
  party_short_name: string | null;
  symbol_name: string | null;
  has_logo: boolean;
  is_featured_party: boolean;
  votes: number;
  percentage: number | null;
  seats: number | null;
  seats_available: boolean;
};

export type PublicAreaProgress = {
  name: string;
  total_offices: number;
  counted_offices: number;
  missing_offices: number;
  percent: number;
};

export type PublicResultsComingSoon = {
  publication: {
    visible: false;
  };
  election: {
    name: string;
    date: string;
  };
  constituency: {
    name: string;
    kind: "local" | "regional";
  };
  metadata: {
    generated_at: string;
  };
};

export type PublicResultsSnapshot = {
  publication: {
    visible: true;
  };
  election: {
    name: string;
    date: string;
  };
  constituency: {
    name: string;
    kind: "local" | "regional";
    seat_count: number;
  };
  status: {
    state: PublicResultsState;
    official: boolean;
    trust_level: "verified";
    data_as_of: string | null;
  };
  completion: {
    counted_offices: number;
    total_offices: number;
    missing_offices: number;
    percent: number;
  };
  totals: {
    registered_voters: number | null;
    registered_voters_known: boolean;
    voters: number;
    ballots_cast: number;
    valid_votes: number;
    invalid_votes: number;
    blank_votes: number;
    other_nonvalid_votes: number;
    turnout_percent: number | null;
    turnout_basis: "counted_offices" | "unavailable";
  };
  lists: PublicResultList[];
  allocation: {
    state: PublicAllocationState;
    seats_total: number;
  };
  area_progress_available: boolean;
  areas: PublicAreaProgress[];
  metadata: {
    generated_at: string;
    data_as_of: string | null;
    official_source: string | null;
  };
};

export type PublicResultsPayload =
  | PublicResultsComingSoon
  | PublicResultsSnapshot;
