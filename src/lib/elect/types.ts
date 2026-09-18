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
  registered_voters: number;
  coverage_state: string;
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
};
