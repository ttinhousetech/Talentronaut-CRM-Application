import User from '@/models/User';
import Lead from '@/models/Lead';
import Notification from '@/models/Notification';
import mongoose from 'mongoose';

/**
 * Intelligent Lead Routing (Auto-Assignment)
 * Finds the sales rep with the lowest number of active leads
 * and assigns the new lead to them.
 */
export async function assignLeadToSalesPerson(leadId: string | mongoose.Types.ObjectId) {
    // 1. Find all active sales team members
    const salesReps = await User.find({
        role: { $in: ['Member', 'Lead'] },
        status: { $ne: 'Inactive' }
    });

    if (salesReps.length === 0) {
        console.warn('No active sales reps found for lead routing.');
        return null; // No active reps to assign
    }

    // 2. Determine workload for each rep (leads in New or In Progress state)
    const repWorkloads = await Lead.aggregate([
        { $match: { status: { $in: ['New', 'In Progress'] }, assignedTo: { $ne: null } } },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
    ]);

    const workloadMap = new Map();
    repWorkloads.forEach(rw => workloadMap.set(rw._id.toString(), rw.count));

    // 3. Find the rep with the minimum workload
    let selectedRepId = salesReps[0]._id;
    let minLoad = Infinity;

    for (const rep of salesReps) {
        const count = workloadMap.get(rep._id.toString()) || 0;
        if (count < minLoad) {
            minLoad = count;
            selectedRepId = rep._id;
        }
    }

    // 4. Update the lead with the assigned rep
    const updatedLead = await Lead.findByIdAndUpdate(
        leadId,
        { assignedTo: selectedRepId },
        { new: true }
    );

    if (updatedLead) {
        // 5. Create a notification for the assigned user
        await Notification.create({
            userId: selectedRepId,
            title: `New Lead Auto-Assigned: ${updatedLead.firstName} ${updatedLead.lastName}`,
            message: `A new lead has been automatically assigned to you.`,
            type: 'Lead',
            link: `/sales/leads` // Assuming standard sales route
        });
        console.log(`Lead ${leadId} automatically assigned to User ${selectedRepId}`);
    }

    return selectedRepId;
}
