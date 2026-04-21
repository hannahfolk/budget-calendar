'use client';

import { useState } from 'react';
import { partnerAPI } from '@/lib/api';

interface PartnerStepProps {
  partnerLinked: boolean;
  partnerName?: string;
  onPartnerLinked: (linked: boolean, name?: string) => void;
}

export default function PartnerStep({
  partnerLinked,
  partnerName,
  onPartnerLinked,
}: PartnerStepProps) {
  const [mode, setMode] = useState<'choice' | 'generate' | 'enter'>('choice');
  const [inviteCode, setInviteCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await partnerAPI.generateInvite();
      setGeneratedCode(result.code);
      setCodeExpiry(new Date(result.expiry).toLocaleString());
    } catch (err: any) {
      setError(err.message || 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkPartner = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await partnerAPI.linkWithCode(inviteCode.trim());
      onPartnerLinked(true, result.partnerName);
    } catch (err: any) {
      setError(err.message || 'Failed to link with partner');
    } finally {
      setLoading(false);
    }
  };

  if (partnerLinked) {
    return (
      <div>
        <h2 className="text-2xl font-display font-bold mb-2">Partner Connected</h2>
        <p className="text-gray-400 font-mono text-sm mb-8">
          You're linked with your partner
        </p>

        <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-green-400 font-mono text-lg mb-2">
            Connected to {partnerName}
          </p>
          <p className="text-gray-400 font-mono text-sm">
            You can view each other's credit cards and share joint expenses
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'generate') {
    return (
      <div>
        <h2 className="text-2xl font-display font-bold mb-2">Generate Invite Code</h2>
        <p className="text-gray-400 font-mono text-sm mb-8">
          Share this code with your partner so they can link with you
        </p>

        {!generatedCode ? (
          <div className="text-center">
            <button
              onClick={handleGenerateCode}
              disabled={loading}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg font-mono transition-colors"
            >
              {loading ? 'Generating...' : 'Generate Invite Code'}
            </button>

            {error && (
              <p className="mt-4 text-red-400 font-mono text-sm">{error}</p>
            )}

            <button
              onClick={() => setMode('choice')}
              className="mt-6 text-gray-400 hover:text-white font-mono text-sm"
            >
              Back
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-700 mb-6">
              <p className="text-gray-400 font-mono text-sm mb-2">Your invite code:</p>
              <p className="text-4xl font-mono font-bold text-blue-400 tracking-widest">
                {generatedCode}
              </p>
              <p className="text-gray-500 font-mono text-xs mt-4">
                Valid until: {codeExpiry}
              </p>
            </div>

            <p className="text-gray-400 font-mono text-sm mb-6">
              Share this code with your partner. They should enter it in their "Enter Partner's Code" screen.
            </p>

            <button
              onClick={() => navigator.clipboard.writeText(generatedCode)}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-mono text-sm transition-colors"
            >
              Copy Code
            </button>

            <button
              onClick={() => setMode('choice')}
              className="mt-6 block mx-auto text-gray-400 hover:text-white font-mono text-sm"
            >
              Back
            </button>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'enter') {
    return (
      <div>
        <h2 className="text-2xl font-display font-bold mb-2">Enter Partner's Code</h2>
        <p className="text-gray-400 font-mono text-sm mb-8">
          Enter the invite code your partner shared with you
        </p>

        <div className="max-w-sm mx-auto">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="XXXXXX"
            maxLength={6}
            className="w-full text-center text-3xl font-mono font-bold tracking-widest bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-4 text-white focus:outline-none focus:border-blue-500 transition-colors uppercase"
          />

          {error && (
            <p className="mt-4 text-red-400 font-mono text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleLinkPartner}
            disabled={loading || inviteCode.length !== 6}
            className="w-full mt-6 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg font-mono transition-colors"
          >
            {loading ? 'Linking...' : 'Link with Partner'}
          </button>

          <button
            onClick={() => {
              setMode('choice');
              setError(null);
              setInviteCode('');
            }}
            className="mt-4 w-full text-gray-400 hover:text-white font-mono text-sm"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-display font-bold mb-2">Partner Connection</h2>
      <p className="text-gray-400 font-mono text-sm mb-8">
        Link with your partner to share joint expenses and see each other's credit cards.
        You can skip this step and do it later.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => setMode('generate')}
          className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-blue-500 transition-colors text-left group"
        >
          <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="text-white font-mono mb-2">Generate Invite Code</h3>
          <p className="text-gray-400 font-mono text-sm">
            Create a code to share with your partner
          </p>
        </button>

        <button
          onClick={() => setMode('enter')}
          className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-blue-500 transition-colors text-left group"
        >
          <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h3 className="text-white font-mono mb-2">Enter Partner's Code</h3>
          <p className="text-gray-400 font-mono text-sm">
            Enter the code your partner shared with you
          </p>
        </button>
      </div>

      <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg">
        <p className="text-gray-400 font-mono text-sm text-center">
          Don't have a partner to link with? Click "Skip" to continue.
          You can always link later from settings.
        </p>
      </div>
    </div>
  );
}
