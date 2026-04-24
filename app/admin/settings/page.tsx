'use client';

import { useMemo } from 'react';
import { AlertTriangle, Database, Link2, ShieldCheck } from 'lucide-react';

const envCards = [
    {
        title: 'CRM Database',
        description: 'The CRM reads from a single MongoDB connection defined by MONGODB_URI.',
        icon: Database,
    },
    {
        title: 'Budget Sync',
        description: 'Budget app leads should be sent to /api/webhooks/leads on this CRM deployment.',
        icon: Link2,
    },
    {
        title: 'Access Control',
        description: 'Webhook access is protected with CRM_WEBHOOK_SECRET when configured.',
        icon: ShieldCheck,
    },
];

export default function AdminSettingsPage() {
    const today = useMemo(() => new Date().toLocaleDateString(), []);

    return (
        <div className="space-y-8 pb-10">
            <div className="rounded-[2rem] border border-amber-100 bg-amber-50/70 p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Settings</h1>
                        <p className="mt-1 text-sm font-medium text-gray-600">
                            This page is a lightweight control center for deployment notes and lead sync health.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {envCards.map((card) => (
                    <div key={card.title} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <card.icon className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">{card.title}</h2>
                        <p className="mt-2 text-sm leading-6 text-gray-500">{card.description}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">Sync checklist</h2>
                <ul className="mt-4 space-y-3 text-sm text-gray-600">
                    <li>• Confirm the budget app is posting to the CRM webhook URL.</li>
                    <li>• Confirm both deployments use the same MongoDB database if you want shared visibility.</li>
                    <li>• Confirm the budget app lead payload includes `appName: Budget App` and `formId: budget-campaign`.</li>
                </ul>
                <p className="mt-6 text-xs font-medium text-gray-400">Updated {today}</p>
            </div>
        </div>
    );
}
