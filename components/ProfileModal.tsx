'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { profileAPI, partnerAPI } from '@/lib/api';
import { useAuth } from './AuthProvider';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  hasPartner: boolean;
  onPartnerLinked: () => void;
}

type Tab = 'profile' | 'password' | 'partner' | 'delete';

export default function ProfileModal({ isOpen, onClose, hasPartner, onPartnerLinked }: Props) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Partner state
  const [partnerLinkMode, setPartnerLinkMode] = useState<'closed' | 'choice' | 'generate' | 'enter'>('closed');
  const [inviteCode, setInviteCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<string | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  // Delete state
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleProfileSave = async () => {
    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const result = await profileAPI.updateProfile({ name, email });
      // Update token if email changed
      if (result.token) {
        localStorage.setItem('token', result.token);
      }
      setProfileSuccess('Profile updated successfully');
      // Reload to refresh user data
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      setPasswordLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      setPasswordLoading(false);
      return;
    }

    try {
      await profileAPI.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    setPartnerLoading(true);
    setPartnerError(null);
    try {
      const result = await partnerAPI.generateInvite();
      setGeneratedCode(result.code);
      setCodeExpiry(new Date(result.expiry).toLocaleString());
    } catch (err: any) {
      setPartnerError(err.message);
    } finally {
      setPartnerLoading(false);
    }
  };

  const handleLinkPartner = async () => {
    if (!inviteCode.trim()) {
      setPartnerError('Please enter an invite code');
      return;
    }

    setPartnerLoading(true);
    setPartnerError(null);
    try {
      await partnerAPI.linkWithCode(inviteCode.trim());
      setPartnerLinkMode('closed');
      setInviteCode('');
      onPartnerLinked();
    } catch (err: any) {
      setPartnerError(err.message);
    } finally {
      setPartnerLoading(false);
    }
  };

  const handleUnlinkPartner = async () => {
    setPartnerLoading(true);
    setPartnerError(null);
    try {
      await partnerAPI.unlinkPartner();
      setShowUnlinkConfirm(false);
      onPartnerLinked();
    } catch (err: any) {
      setPartnerError(err.message);
    } finally {
      setPartnerLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm');
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await profileAPI.deleteAccount(deletePassword);
      logout();
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'password', label: 'Password' },
    { id: 'partner', label: 'Partner' },
    { id: 'delete', label: 'Delete' },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative glass-panel rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold text-white">Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-xl"
            >
              &times;
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 bg-gray-800/50 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-2 text-xs font-mono rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                } ${tab.id === 'delete' ? 'text-red-400 hover:text-red-300' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              {profileError && (
                <p className="text-red-400 font-mono text-sm">{profileError}</p>
              )}
              {profileSuccess && (
                <p className="text-green-400 font-mono text-sm">{profileSuccess}</p>
              )}
              <button
                onClick={handleProfileSave}
                disabled={profileLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-mono py-2 rounded-lg transition-colors"
              >
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              {passwordError && (
                <p className="text-red-400 font-mono text-sm">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-green-400 font-mono text-sm">{passwordSuccess}</p>
              )}
              <button
                onClick={handlePasswordChange}
                disabled={passwordLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-mono py-2 rounded-lg transition-colors"
              >
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          )}

          {/* Partner Tab */}
          {activeTab === 'partner' && (
            <div className="space-y-4">
              {hasPartner ? (
                <>
                  <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <p className="text-sm font-mono text-gray-400 mb-1">Linked with</p>
                    <p className="text-lg font-semibold text-cyan-400">{user?.partnerName}</p>
                  </div>

                  {!showUnlinkConfirm ? (
                    <button
                      onClick={() => setShowUnlinkConfirm(true)}
                      className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 font-mono py-2 rounded-lg transition-colors"
                    >
                      Unlink Partner
                    </button>
                  ) : (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-3">
                      <p className="text-sm font-mono text-red-400">
                        Are you sure you want to unlink from {user?.partnerName}?
                      </p>
                      <p className="text-xs font-mono text-gray-500">
                        This will remove the partner connection for both accounts.
                      </p>
                      {partnerError && (
                        <p className="text-red-400 font-mono text-xs">{partnerError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleUnlinkPartner}
                          disabled={partnerLoading}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white text-sm font-mono py-2 rounded-lg transition-colors"
                        >
                          {partnerLoading ? 'Unlinking...' : 'Yes, Unlink'}
                        </button>
                        <button
                          onClick={() => { setShowUnlinkConfirm(false); setPartnerError(null); }}
                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-sm font-mono py-2 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {partnerLinkMode === 'closed' && (
                    <div className="text-center py-4">
                      <p className="text-gray-400 font-mono text-sm mb-4">No partner linked</p>
                      <button
                        onClick={() => setPartnerLinkMode('choice')}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-mono px-6 py-2 rounded-lg transition-colors"
                      >
                        Link with Partner
                      </button>
                    </div>
                  )}

                  {partnerLinkMode === 'choice' && (
                    <div className="space-y-2">
                      <button
                        onClick={() => setPartnerLinkMode('generate')}
                        className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-blue-500 transition-colors text-left"
                      >
                        <span className="text-white font-mono text-sm">Generate Invite Code</span>
                        <p className="text-gray-500 font-mono text-xs">Share with your partner</p>
                      </button>
                      <button
                        onClick={() => setPartnerLinkMode('enter')}
                        className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-purple-500 transition-colors text-left"
                      >
                        <span className="text-white font-mono text-sm">Enter Partner's Code</span>
                        <p className="text-gray-500 font-mono text-xs">Link using their code</p>
                      </button>
                      <button
                        onClick={() => setPartnerLinkMode('closed')}
                        className="w-full text-gray-500 hover:text-gray-400 font-mono text-xs py-2"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {partnerLinkMode === 'generate' && (
                    <div className="space-y-3">
                      {!generatedCode ? (
                        <>
                          <button
                            onClick={handleGenerateCode}
                            disabled={partnerLoading}
                            className="w-full p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg font-mono text-sm transition-colors"
                          >
                            {partnerLoading ? 'Generating...' : 'Generate Code'}
                          </button>
                          {partnerError && (
                            <p className="text-red-400 font-mono text-xs">{partnerError}</p>
                          )}
                        </>
                      ) : (
                        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                          <p className="text-gray-400 font-mono text-xs mb-2">Your invite code:</p>
                          <p className="text-3xl font-mono font-bold text-blue-400 tracking-widest text-center">
                            {generatedCode}
                          </p>
                          <p className="text-gray-500 font-mono text-[10px] mt-2 text-center">
                            Valid until: {codeExpiry}
                          </p>
                          <button
                            onClick={() => navigator.clipboard.writeText(generatedCode)}
                            className="w-full mt-3 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-mono text-xs transition-colors"
                          >
                            Copy Code
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => { setPartnerLinkMode('choice'); setGeneratedCode(null); setPartnerError(null); }}
                        className="w-full text-gray-500 hover:text-gray-400 font-mono text-xs py-2"
                      >
                        Back
                      </button>
                    </div>
                  )}

                  {partnerLinkMode === 'enter' && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="XXXXXX"
                        maxLength={6}
                        className="w-full text-center text-2xl font-mono font-bold tracking-widest bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors uppercase"
                      />
                      {partnerError && (
                        <p className="text-red-400 font-mono text-xs">{partnerError}</p>
                      )}
                      <button
                        onClick={handleLinkPartner}
                        disabled={partnerLoading || inviteCode.length !== 6}
                        className="w-full p-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded-lg font-mono text-sm transition-colors"
                      >
                        {partnerLoading ? 'Linking...' : 'Link with Partner'}
                      </button>
                      <button
                        onClick={() => { setPartnerLinkMode('choice'); setInviteCode(''); setPartnerError(null); }}
                        className="w-full text-gray-500 hover:text-gray-400 font-mono text-xs py-2"
                      >
                        Back
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Delete Tab */}
          {activeTab === 'delete' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 font-mono text-sm font-semibold mb-2">Danger Zone</p>
                <p className="text-gray-400 font-mono text-xs">
                  Deleting your account is permanent and cannot be undone. All your budget data will be lost.
                </p>
              </div>
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-1">Enter your password</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-1">
                  Type <span className="text-red-400">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>
              {deleteError && (
                <p className="text-red-400 font-mono text-sm">{deleteError}</p>
              )}
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText !== 'DELETE' || !deletePassword}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white font-mono py-2 rounded-lg transition-colors"
              >
                {deleteLoading ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
