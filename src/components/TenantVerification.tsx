import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const TenantVerification: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const { verifyTenant, tenantVerification, createTenant, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isCreatingTenant) {
        const created = await createTenant(email);
        if (created) {
          navigate('/');
        }
      } else {
        // if the user not signed in, then sign in with google
        const user = await loginWithGoogle();
        if (!user) {
          throw new Error('Failed to sign in with Google');
        }
        const verified = await verifyTenant(email, user!.email!);
        if (verified) {
          navigate('/');
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to verify tenant');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsCreatingTenant(!isCreatingTenant);
    setError('');
  };

  const handleCreateTenant = async () => {
    setError('');
    setLoading(true);
    
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            {isCreatingTenant ? 'Create New Tenant' : 'Enter Your Tenant Email'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isCreatingTenant
              ? 'Create a new tenant with your email address'
              : 'Please verify your tenant email to continue'}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {!isCreatingTenant && <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <label htmlFor="email" className="sr-only">
                'Tenant Email'
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="relative block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                placeholder='Enter your tenant email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>}

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          {tenantVerification?.error && (
            <div className="text-red-500 text-sm text-center">
              {tenantVerification.error}
            </div>
          )}

          <div className="flex flex-col space-y-4">
            {isCreatingTenant ?
              <button
                onClick={handleCreateTenant}
                type='button'
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Create Tenant'}
              </button> : <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
              >
                {loading ? 'Processing...' : (isCreatingTenant ? 'Create Tenant' : 'Verify Tenant')}
              </button>}

            <button
              type="button"
              onClick={toggleMode}
              disabled={loading}
              className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
            >
              {isCreatingTenant
                ? '← Back to tenant verification'
                : 'Create a new tenant instead →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TenantVerification; 