'use client';

import { useEffect, useState } from 'react';
import { partnerAPI, Partner, CreditCard } from '@/lib/api';

interface PartnerCardsStepProps {
  partnerName?: string;
}

export default function PartnerCardsStep({ partnerName }: PartnerCardsStepProps) {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPartner = async () => {
      try {
        const result = await partnerAPI.getPartner();
        setPartner(result.partner);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch partner info');
      } finally {
        setLoading(false);
      }
    };

    fetchPartner();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400 font-mono">Loading partner info...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl font-display font-bold mb-2">Partner Cards</h2>
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 font-mono text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div>
        <h2 className="text-2xl font-display font-bold mb-2">Partner Cards</h2>
        <p className="text-gray-400 font-mono text-sm mb-8">
          No partner linked yet.
        </p>
      </div>
    );
  }

  // Combine all partner's cards
  const allPartnerCards = [
    ...(partner.creditCards || []),
    ...(partner.personalCreditCards || []),
  ];

  return (
    <div>
      <h2 className="text-2xl font-display font-bold mb-2">Partner's Cards</h2>
      <p className="text-gray-400 font-mono text-sm mb-8">
        Here are {partnerName || partner.name}'s credit cards for reference
      </p>

      {allPartnerCards.length === 0 ? (
        <p className="text-gray-500 font-mono text-sm p-4 bg-gray-800/30 rounded-lg">
          Your partner hasn't added any cards yet
        </p>
      ) : (
        <div className="space-y-3">
          {allPartnerCards.map((card, index) => (
            <div key={index} className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-mono text-white">{card.name}</span>
                <span className="text-sm font-mono text-gray-400">
                  Budget: ${card.projected.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 text-xs font-mono text-gray-500">
                Closes on {card.closingDay === 0 ? 'last day of month' : `day ${card.closingDay}`}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-blue-300 font-mono text-sm">
          You can view your partner's cards. When they make purchases with joint expenses,
          those will appear in your shared budget tracking.
        </p>
      </div>
    </div>
  );
}
