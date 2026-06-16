import User from '@/models/User';

export async function buildUserResponse(user: any) {
  let partnerName: string | undefined;
  let partnerJointExpenses: any[] = [];
  let mergedDeposits = [...(user.recurringDeposits || [])];
  let userCreditCards = [...(user.creditCards || [])];

  if (user.partnerId) {
    const partner = await User.findById(user.partnerId);
    if (partner) {
      partnerName = partner.name;

      partnerJointExpenses = partner.monthlyExpenses
        .filter((e: any) => e.account === 'joint')
        .filter(
          (e: any) =>
            !user.monthlyExpenses.find(
              (ue: any) => ue.name === e.name && ue.account === 'joint'
            )
        );

      const partnerJointDeposits = (partner.recurringDeposits || []).filter(
        (d: any) => d.account === 'joint'
      );
      for (const deposit of partnerJointDeposits) {
        if (
          !mergedDeposits.find(
            (d: any) => d.name === deposit.name && d.account === 'joint'
          )
        ) {
          mergedDeposits.push(deposit);
        }
      }

      // Single source of truth for joint cards: when both partners onboarded the
      // same joint card by name, the earlier signup owns the canonical record.
      // The other partner's duplicate is hidden from the merged list, so both
      // partners see (and write to) the same card — its joint amounts live on
      // the canonical owner's document and never diverge.
      const userIsEarlier =
        !partner.createdAt ||
        (user.createdAt && user.createdAt <= partner.createdAt);
      const partnerCards = partner.creditCards || [];
      const userId = user._id?.toString?.() ?? String(user._id);
      const partnerId = partner._id?.toString?.() ?? String(partner._id);

      if (!userIsEarlier) {
        userCreditCards = userCreditCards.filter(
          (c: any) => !partnerCards.find((pc: any) => pc.name === c.name)
        );
      }

      for (const card of partnerCards) {
        if (!userCreditCards.find((c: any) => c.name === card.name)) {
          userCreditCards.push(card);
        }
      }

      // Stamp addedBy so the frontend's isPartnerCard check is unambiguous and
      // routes writes to the canonical owner (legacy rows may be missing this).
      userCreditCards = userCreditCards.map((c: any) => {
        const plain = c.toObject ? c.toObject() : { ...c };
        if (!plain.addedBy) {
          const ownedByUser = (user.creditCards || []).find(
            (uc: any) => uc.name === plain.name
          );
          const ownedByPartner = partnerCards.find(
            (pc: any) => pc.name === plain.name
          );
          if (ownedByUser && (userIsEarlier || !ownedByPartner)) {
            plain.addedBy = userId;
          } else if (ownedByPartner) {
            plain.addedBy = partnerId;
          }
        }
        return plain;
      });
    }
  }

  const creditCardOrder = user.creditCardOrder || [];
  if (creditCardOrder.length > 0) {
    userCreditCards.sort((a: any, b: any) => {
      const aIdx = creditCardOrder.indexOf(a.name);
      const bIdx = creditCardOrder.indexOf(b.name);
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return 1;
      return aIdx - bIdx;
    });
  }

  return {
    id: user._id,
    email: user.email,
    name: user.name,
    monthlyExpenses: user.monthlyExpenses,
    partnerJointExpenses,
    recurringDeposits: mergedDeposits,
    creditCards: userCreditCards,
    personalCreditCards: user.personalCreditCards || [],
    personalStartingBalance: user.personalStartingBalance || 0,
    jointStartingBalance: user.jointStartingBalance || 0,
    onboardingCompleted: user.onboardingCompleted || false,
    partnerId: user.partnerId,
    partnerName,
    createdAt: user.createdAt,
  };
}
