import crypto from 'crypto';

export const generateSaveHash = (data: any): string => {
  const str = JSON.stringify(data);
  // In a real scenario, you might append a server-side secret salt to prevent client-side forgery
  // if the client knows the algorithm.
  // For now, simple SHA256 of the data. 
  // Ideally, the client shouldn't be generating the hash to verify integrity; 
  // the server generates it on save and verifies it on load/update.
  // OR the client sends a hash signed by a secret they don't have? 
  // Let's assume server-side integrity check for now.
  return crypto.createHash('sha256').update(str).digest('hex');
};

export const verifySaveHash = (data: any, hash: string): boolean => {
  return generateSaveHash(data) === hash;
};
