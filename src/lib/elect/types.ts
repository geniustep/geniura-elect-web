export type ElectRole = "observer" | "coordinator" | "manager";

export type PartyRef = {
  id: number;
  name: string;
  short_name?: string | null;
  code: string;
};

export type CandidateListRef = {
  id: number;
  name: string;
  code: string;
  ballot_number?: number | null;
  party?: PartyRef | null;
  head_candidate_name?: string | null;
};

export type ElectionSummary = {
  id: number;
  name: string;
  code: string;
  election_date: string;
  election_kind: string;
  state: string;
  poll_open_time: string;
  poll_close_time: string;
  result_structure: string;
  rules: {
    seat_allocation_method: string;
    quotient_basis: string;
    single_list_min_registered_percent: number;
    remainder_tie_breaker: string;
  };
  coverage: {
    polling_office_count: number;
    covered_office_count: number;
    percent: number;
  };
  constituencies: {
    local_count: number;
    regional_count: number;
  };
};

export type PollingOffice = {
  id: number;
  code: string;
  number: number;
  registered_voters: number | null;
  registered_voters_known: boolean;
  coverage_state: string;
  area?: {
    id: number;
    name: string;
    code: string;
  } | null;
  central_office?: {
    id: number;
    number: number;
    name: string | null;
  } | null;
  center: {
    id: number;
    name: string;
    code: string;
    address?: string | null;
    commune?: string | null;
  };
  constituency: {
    id: number;
    name: string;
    code: string;
  };
  region: {
    id: number;
    name: string;
    code: string;
  };
  primary_representative?: {
    id: number;
    name: string;
    status: string;
    check_in_at?: string | null;
  } | null;
  protocol?: ProtocolRecord | null;
};

export type ProtocolResult = {
  candidate_list: CandidateListRef;
  votes: number;
};

export type ProtocolSection = {
  id?: number;
  kind: "local" | "regional";
  constituency: {
    id: number;
    name: string;
    code: string;
  };
  registered_voters: number;
  voters: number;
  ballots_cast: number;
  valid_votes: number;
  invalid_votes: number;
  blank_votes: number;
  other_nonvalid_votes: number;
  list_vote_total?: number;
  accounted_ballots?: number;
  ballot_accounting_gap?: number;
  voter_ballot_gap?: number;
  configured_list_count?: number;
  entered_list_count?: number;
  consistency?: {
    state: "incomplete" | "inconsistent" | "consistent";
    message: string;
  };
  results: ProtocolResult[];
};

export type ProtocolTemplate = {
  polling_office_id: number;
  election_id: number;
  result_structure: string;
  sections: ProtocolSection[];
};

export type ProtocolRecord = {
  id: number;
  polling_office_id: number;
  state: string;
  consistency: {
    state: "incomplete" | "inconsistent" | "consistent";
    message: string;
  };
  document: {
    count: number;
    integrity_state: string;
    digest?: string | null;
    validated_digest?: string | null;
    verified_digest?: string | null;
    items: Array<{
      id: number;
      name: string;
      mimetype?: string | null;
      file_size?: number | null;
    }>;
  };
  workflow: {
    can_validate: boolean;
    can_verify: boolean;
    entered_by?: { id: number; name: string } | null;
    entered_at?: string | null;
    validated_by?: { id: number; name: string } | null;
    validated_at?: string | null;
    verified_by?: { id: number; name: string } | null;
    verified_at?: string | null;
    rejection_reason?: string | null;
  };
  sections: ProtocolSection[];
};

export type ElectionDashboard = {
  election: ElectionSummary;
  polling_offices: {
    total: number;
    covered: number;
    uncovered: number;
    coverage_percent: number;
  };
  protocols: {
    total: number;
    missing: number;
    states: Record<string, number>;
    inconsistent: number;
  };
  incidents?: {
    total: number;
    open: number;
    high_open: number;
    states: Record<string, number>;
  };
};


export type ConstituencySummary = {
  id: number;
  name: string;
  code: string;
  kind: "local" | "regional";
  seat_count: number;
  registered_voters: number;
  region: {
    id: number;
    name: string;
    code: string;
  };
  coverage: {
    polling_office_count: number;
    covered_office_count: number;
    percent: number;
  };
  candidate_lists: CandidateListRef[];
};

export type ConstituencyResult = {
  constituency_id: number;
  constituency_kind: "local" | "regional";
  trust_level: "received" | "validated" | "verified";
  nature: "projection" | "internal_calculation";
  official_result: false;
  office_count: number;
  trusted_office_count: number;
  missing_office_count: number;
  completeness_percent: number;
  configured_registered_voters: number;
  totals: {
    reported_registered_voters: number;
    voters: number;
    ballots_cast: number;
    valid_votes: number;
    invalid_votes: number;
    blank_votes: number;
    other_nonvalid_votes: number;
  };
  votes_by_list: Record<string, number>;
  allocation: {
    method: string;
    basis?: string;
    basis_total?: number;
    quotient?: {
      numerator: number;
      denominator: number;
      decimal: number;
    };
    seats_total: number;
    seats_by_list: Record<string, number>;
    allocation_complete: boolean;
    unresolved: Array<Record<string, unknown>>;
  } | null;
  allocation_error?: string | null;
};


export type ElectionIncident = {
  id: number;
  polling_office: {
    id: number;
    number: number;
    code: string;
    center_name: string;
  };
  category:
    | "access"
    | "operations"
    | "voting"
    | "counting"
    | "documentation"
    | "other";
  severity: "low" | "medium" | "high";
  state: "reported" | "acknowledged" | "resolved" | "closed";
  description: string;
  resolution_note?: string | null;
  reported_by?: { id: number; name: string } | null;
  reported_at: string;
  acknowledged_by?: { id: number; name: string } | null;
  acknowledged_at?: string | null;
  resolved_by?: { id: number; name: string } | null;
  resolved_at?: string | null;
  closed_by?: { id: number; name: string } | null;
  closed_at?: string | null;
};


export type SetupRegion = {
  id: number;
  name: string;
  code: string;
};

export type SetupPollingArea = {
  id: number;
  name: string;
  code: string;
  source_filename?: string | null;
  constituency: {
    id: number;
    name: string;
    code: string;
  };
  center_count: number;
  central_office_count: number;
};

export type SetupCentralOffice = {
  id: number;
  number: number;
  name: string | null;
  area: SetupPollingArea;
  office_count: number;
};

export type SetupCenter = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  commune?: string | null;
  area?: SetupPollingArea | null;
  constituency: {
    id: number;
    name: string;
    code: string;
  };
  office_count: number;
};

export type SetupRepresentative = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  has_user_account: boolean;
};

export type SetupAssignment = {
  id: number;
  role: "primary" | "backup" | "coordinator";
  status:
    | "planned"
    | "notified"
    | "confirmed"
    | "present"
    | "absent"
    | "replaced"
    | "cancelled"
    | "closed";
  check_in_at?: string | null;
  office: {
    id: number;
    number: number;
    code: string;
    center_name: string;
  };
  representative: {
    id: number;
    name: string;
    phone?: string | null;
  };
};

export type SetupParty = {
  id: number;
  name: string;
  short_name?: string | null;
  code: string;
};

export type SetupCandidate = {
  id: number;
  name: string;
  birth_date?: string | null;
};

export type SetupCandidateListMember = {
  id: number;
  sequence: number;
  candidate_list: {
    id: number;
    name: string;
    code: string;
  };
  candidate: SetupCandidate;
};

export type SetupCandidateList = {
  id: number;
  name: string;
  code: string;
  ballot_number?: number | null;
  head_candidate_name?: string | null;
  constituency: {
    id: number;
    name: string;
    code: string;
    kind: "local" | "regional";
  };
  party?: SetupParty | null;
  members: SetupCandidateListMember[];
  member_count: number;
};

export type ElectionSetupSnapshot = {
  election: ElectionSummary;
  regions: SetupRegion[];
  constituencies: ConstituencySummary[];
  areas: SetupPollingArea[];
  central_offices: SetupCentralOffice[];
  centers: SetupCenter[];
  offices: PollingOffice[];
  representatives: SetupRepresentative[];
  assignments: SetupAssignment[];
  parties: SetupParty[];
  candidates: SetupCandidate[];
  candidate_lists: SetupCandidateList[];
  list_members: SetupCandidateListMember[];
};

export type ElectionSetupSection =
  | "constituencies"
  | "areas"
  | "central-offices"
  | "centers"
  | "offices"
  | "representatives"
  | "assignments";
