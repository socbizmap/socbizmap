export type PinKind = 'seek' | 'offer';
export type Vertical = 'work' | 'service';
export type PinStatus =
  | 'pending'
  | 'revision'
  | 'rejected'
  | 'live'
  | 'closed'
  | 'hidden'
  | 'archived'
  | 'deleted';
export type PinCategory =
  | 'workers'
  | 'construction'
  | 'home'
  | 'it'
  | 'trade'
  | 'horeca'
  | 'students'
  | 'other';
export type MediaKind = 'photo' | 'video';
export type UserRole = 'user' | 'admin';
export type UserPlan = 'free' | 'pro';
export type AccountKind = 'person' | 'fop' | 'company';

export type GeoPoint = { lat: number; lng: number };

export type Profile = {
  id: string;
  phone: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  defaultMode: PinKind;
  vertical: Vertical;
  radiusKm: number;
  lastGeog: GeoPoint | null;
  ratingAvg: number;
  ratingCount: number;
  oblast: string;
  localeOverride: 'uk' | 'en' | null;
  role: UserRole;
  plan: UserPlan;
  accountKind: AccountKind;
};

export type Session = {
  userId: string;
  phone: string | null;
  email: string | null;
};

export type PinMedia = {
  id: string;
  pinId: string;
  kind: MediaKind;
  path: string;
  sort: number;
};

export type Pin = {
  id: string;
  authorId: string;
  kind: PinKind;
  vertical: Vertical;
  title: string;
  category: PinCategory;
  description: string;
  schedule: string;
  payAmount: number | null;
  payCurrency: 'UAH';
  contactPhone: string | null;
  geog: GeoPoint;
  city: string;
  status: PinStatus;
  moderationNote: string | null;
  boostUntil: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  distanceM?: number;
  thumbnailPath?: string | null;
  media: PinMedia[];
};

export type MapFilters = {
  origin: GeoPoint;
  radiusKm: number;
  kind: PinKind;
  vertical: Vertical;
  search: string;
};

export type CreatePinInput = {
  kind: PinKind;
  vertical: Vertical;
  title: string;
  category: PinCategory;
  description: string;
  schedule: string;
  payAmount: number | null;
  contactPhone: string;
  geog: GeoPoint;
  city: string;
  media?: { kind: MediaKind; path: string }[];
};

export type UpdatePinInput = Partial<
  Omit<CreatePinInput, 'vertical'> & { status: PinStatus }
>;

export type Quota = {
  used: number;
  limit: number;
  plan: UserPlan;
};

export class DataError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type DataApi = {
  backend: 'mock' | 'supabase';
  getSession(): Promise<Session | null>;
  onAuthChange(cb: (session: Session | null) => void): () => void;
  sendOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<Session>;
  sendEmailOtp(email: string): Promise<void>;
  verifyEmailOtp(email: string, code: string): Promise<Session>;
  signOut(): Promise<void>;
  getProfile(userId?: string): Promise<Profile | null>;
  updateProfile(patch: Partial<Pick<Profile, 'displayName' | 'radiusKm' | 'vertical' | 'defaultMode' | 'lastGeog'>>): Promise<Profile>;
  listLivePins(filters: MapFilters): Promise<Pin[]>;
  getPin(id: string): Promise<Pin | null>;
  listMyPins(): Promise<Pin[]>;
  createPin(input: CreatePinInput): Promise<Pin>;
  updatePin(id: string, input: UpdatePinInput): Promise<Pin>;
  getQuota(): Promise<Quota>;
  replyToPin(pinId: string): Promise<{ contactPhone: string }>;
  rate(pinId: string, toId: string, stars: number): Promise<void>;
  registerDevice(token: string): Promise<void>;
  unregisterDevice(): Promise<void>;
  listModerationQueue(): Promise<Pin[]>;
  moderatePin(id: string, status: Extract<PinStatus, 'live' | 'revision' | 'rejected'>, note?: string): Promise<void>;
};
