import User from '@/models/User';

export async function buildUserResponse(user: any) {
  let partnerName: string | undefined;
  let partnerJointExpenses: any[] = [];
  let mergedDeposits = [...(user.recurringDeposits || [])];
  const userCreditCards = [...(user.creditCards || [])];

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

      for (const card of partner.creditCards || []) {
        if (!userCreditCards.find((c: any) => c.name === card.name)) {
          userCreditCards.push(card);
        }
      }
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
