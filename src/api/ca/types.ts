export interface ProfileCO {
  id: string | number;
  name: string;
  type?: string;
  description: string;
  conf?: string;
  profileCategory?: string;
  pairedProfileId?: number;
}

export interface DualCertProfileCO {
  pairName: string;
  pairDisplayName: string;
  pairDescription: string;
  signProfile: ProfileCO;
  encProfile: ProfileCO;
}
