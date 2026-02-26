'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Mail,
  MoreHorizontal,
  Crown,
  User,
  Clock,
  CheckCircle,
  X,
  Search,
  Edit,
  Trash2,
  Save,
  XCircle,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { useParams } from 'next/navigation';

interface TeamSlideOverProps {
  data: {
    mode?: 'view' | 'invite';
  } | null;
  onClose: () => void;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  lastActive?: string;
  isOnline?: boolean;
  phone?: string;
  department?: string;
  joinedAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  invitedAt: string;
  invitedBy: string;
}

export function TeamSlideOver({ data, onClose }: TeamSlideOverProps) {
  const params = useParams();
  const subdomain = params?.subdomain as string;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(data?.mode === 'invite');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('REQUESTER');
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    role: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'invites'>('members');

  useEffect(() => {
    fetchTeamData();
  }, []);

  useEffect(() => {
    if (data?.mode === 'invite') {
      setIsInviting(true);
    }
  }, [data]);

  const fetchTeamData = async () => {
    try {
      const res = await fetch(`/api/team/${subdomain}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setPendingInvites(data.pendingInvites || []);
        setUserRole(data.userRole);
      }
    } catch (error) {
      console.error('Failed to fetch team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/team/${subdomain}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (res.ok) {
        const newInvite = await res.json();
        setPendingInvites((prev) => [newInvite, ...prev]);
        setInviteEmail('');
        setIsInviting(false);
      }
    } catch (error) {
      console.error('Failed to invite:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/team/${subdomain}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        );
      }
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleUpdateMember = async () => {
    if (!editingMember) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/team/${subdomain}/members/${editingMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        const updated = await res.json();
        setMembers((prev) =>
          prev.map((m) => (m.id === updated.id ? updated : m))
        );
        setEditingMember(null);
      }
    } catch (error) {
      console.error('Failed to update member:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const res = await fetch(`/api/team/${subdomain}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/team/${subdomain}/invites/${inviteId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
      }
    } catch (error) {
      console.error('Failed to cancel invite:', error);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/team/${subdomain}/invites/${inviteId}/resend`, {
        method: 'POST',
      });

      if (res.ok) {
        alert('Invitation resent successfully');
      }
    } catch (error) {
      console.error('Failed to resend invite:', error);
    }
  };

  const startEditing = (member: TeamMember) => {
    setEditingMember(member);
    setEditForm({
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      department: member.department || '',
      role: member.role,
    });
  };

  const isAdmin = userRole === 'CUSTOMER_ADMIN' || userRole === 'ADMIN';

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      CUSTOMER_ADMIN: 'bg-purple-100 text-purple-700',
      ADMIN: 'bg-purple-100 text-purple-700',
      REQUESTER: 'bg-blue-100 text-blue-700',
      VIEWER: 'bg-stone-100 text-stone-700',
      AGENT: 'bg-emerald-100 text-emerald-700',
    };
    return colors[role] || 'bg-stone-100 text-stone-700';
  };

  // Edit Member Form
  if (editingMember) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Edit Member</h2>
              <p className="text-sm text-stone-500">Update member details</p>
            </div>
            <button
              onClick={() => setEditingMember(null)}
              className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="text-xl font-semibold text-brand-700">
                {editForm.name[0] || editingMember.email[0]}
              </span>
            </div>
            <div>
              <p className="font-medium text-stone-900">{editingMember.name}</p>
              <p className="text-sm text-stone-500">{editingMember.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Full Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Email</label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Phone</label>
            <input
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Department</label>
            <input
              type="text"
              value={editForm.department}
              onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))}
              placeholder="e.g., Engineering, Support"
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Role</label>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
            >
              <option value="CUSTOMER_ADMIN">Admin</option>
              <option value="REQUESTER">Requester</option>
              <option value="VIEWER">Viewer</option>
              <option value="AGENT">Agent</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between">
          <button
            onClick={() => setEditingMember(null)}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdateMember}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Team</h2>
            <p className="text-sm text-stone-500">
              {members.length} member{members.length !== 1 ? 's' : ''}
              {pendingInvites.length > 0 && ` • ${pendingInvites.length} pending`}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsInviting(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Invite
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-stone-100">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'members'
              ? 'bg-stone-900 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Members
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
            activeTab === 'invites'
              ? 'bg-stone-900 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Invites
          {pendingInvites.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {pendingInvites.length}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      {activeTab === 'members' && (
        <div className="px-6 py-3 border-b border-stone-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team members..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-sm"
            />
          </div>
        </div>
      )}

      {/* Invite Form */}
      <AnimatePresence>
        {isInviting && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-stone-100 overflow-hidden"
          >
            <div className="p-4 bg-stone-50 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-stone-900">Invite Team Member</h3>
                <button
                  onClick={() => setIsInviting(false)}
                  className="p-1 hover:bg-stone-200 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-stone-500" />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-sm"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-sm"
                >
                  <option value="REQUESTER">Requester</option>
                  <option value="VIEWER">Viewer</option>
                  <option value="CUSTOMER_ADMIN">Admin</option>
                  <option value="AGENT">Agent</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || isSubmitting}
                  className="px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {isSubmitting ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'members' ? (
          <div className="p-4">
            <div className="grid grid-cols-1 gap-3">
              {filteredMembers.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group flex items-center gap-3 p-3 rounded-lg bg-white border border-stone-200 hover:border-brand-300 hover:shadow-sm transition-all"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-stone-600">
                          {member.name[0]}
                        </span>
                      )}
                    </div>
                    {member.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-stone-900">{member.name}</p>
                      {member.role === 'CUSTOMER_ADMIN' || member.role === 'ADMIN' ? (
                        <Crown className="w-3 h-3 text-amber-500" />
                      ) : null}
                    </div>
                    <p className="text-xs text-stone-500 truncate">{member.email}</p>
                    {member.department && (
                      <p className="text-[10px] text-stone-400">{member.department}</p>
                    )}
                  </div>

                  {isAdmin ? (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        className="text-xs font-medium bg-transparent border-none focus:ring-0 cursor-pointer text-stone-600"
                      >
                        <option value="CUSTOMER_ADMIN">Admin</option>
                        <option value="REQUESTER">Requester</option>
                        <option value="VIEWER">Viewer</option>
                        <option value="AGENT">Agent</option>
                      </select>
                      <button
                        onClick={() => startEditing(member)}
                        className="p-1.5 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                        member.role
                      )}`}
                    >
                      {member.role.replace('_', ' ')}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>

            {filteredMembers.length === 0 && (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-sm text-stone-500">
                  {searchQuery ? 'No members found' : 'No team members yet'}
                </p>
                {!searchQuery && isAdmin && (
                  <button
                    onClick={() => setIsInviting(true)}
                    className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Invite your first member
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Pending Invites Tab */
          <div className="p-4">
            {pendingInvites.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-sm text-stone-500">No pending invites</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-amber-50/50 border border-amber-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Mail className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-stone-900 truncate">{invite.email}</p>
                      <p className="text-xs text-stone-500">
                        Invited {new Date(invite.invitedAt).toLocaleDateString()} • {invite.invitedBy}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                        invite.role
                      )}`}
                    >
                      {invite.role.replace('_', ' ')}
                    </span>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleResendInvite(invite.id)}
                          className="p-1.5 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                          title="Resend invite"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Cancel invite"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
