import { Suspense, type JSX } from 'react';

import SignupEntryInner from './signup-entry-inner';

function SignupSkeleton(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
        role="status"
        aria-label="Iniciando registro..."
      />
    </div>
  );
}

export default function SignupEntryPage(): JSX.Element {
  return (
    <Suspense fallback={<SignupSkeleton />}>
      <SignupEntryInner />
    </Suspense>
  );
}
