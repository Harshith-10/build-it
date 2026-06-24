import React from 'react';
import { getCode365Analytics } from '@/actions/faculty/code365-analytics';
import { Activity, Users, Zap, CheckCircle } from 'lucide-react';

export default async function Code365Analytics() {
  const analytics = await getCode365Analytics();

  if (!analytics.success || !analytics.data) {
    return <div className="p-8 text-red-500">Failed to load analytics data.</div>;
  }

  const { totalSubmissions, todaySolves, todaysProblemTitle, activeStreaks, recentSubmissions } = analytics.data;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Code365 Command Center</h1>
          <p className="text-gray-500 mt-2">Track student engagement and daily challenge analytics.</p>
        </div>
        <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-medium border border-indigo-100">
          Today's Problem: {todaysProblemTitle}
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-lg text-blue-600"><CheckCircle size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Solved Today</p>
            <p className="text-2xl font-bold text-gray-900">{todaySolves}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-purple-100 p-3 rounded-lg text-purple-600"><Activity size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Submissions</p>
            <p className="text-2xl font-bold text-gray-900">{totalSubmissions}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-orange-100 p-3 rounded-lg text-orange-600"><Zap size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Streaks</p>
            <p className="text-2xl font-bold text-gray-900">{activeStreaks.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-lg text-green-600"><Users size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Highest Streak</p>
            <p className="text-2xl font-bold text-gray-900">
              {activeStreaks.length > 0 ? activeStreaks[0].currentStreak : 0} 🔥
            </p>
          </div>
        </div>
      </div>

      {/* Recent Submissions Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-800">Recent Submissions (Live)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-white border-b border-gray-200 text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">User ID</th>
                <th className="px-6 py-3 font-medium">Problem ID</th>
                <th className="px-6 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-400">
                    No submissions yet. Be the first!
                  </td>
                </tr>
              ) : (
                recentSubmissions.map((sub, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900">{sub.userId}</td>
                    <td className="px-6 py-3 text-indigo-600">{sub.problemId}</td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Completed
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}