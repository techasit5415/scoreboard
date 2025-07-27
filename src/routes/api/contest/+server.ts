export const GET = async ({ fetch }: { fetch: any }) => {
  try {
    // Get contest information
    const contestsResponse = await fetch('http://codearcade.cskmitl.com/api/v4/contests', {
      signal: AbortSignal.timeout(5000)
    });
    
    if (contestsResponse.ok) {
      const contests = await contestsResponse.json();
      
      if (contests.length > 0) {
        const contest = contests[0];
        const contestId = contest.id;
        
        // Get problems for this contest
        const problemsResponse = await fetch(`http://codearcade.cskmitl.com/api/v4/contests/${contestId}/problems`, {
          signal: AbortSignal.timeout(5000)
        });
        
        let problems = [];
        if (problemsResponse.ok) {
          problems = await problemsResponse.json();
        }
        
        return new Response(JSON.stringify({
          contest: {
            id: contest.id,
            name: contest.name || `Contest ${contest.id}`,
            start_time: contest.start_time,
            end_time: contest.end_time,
            freeze_time: contest.freeze_time,
            unfreeze_time: contest.unfreeze_time,
            penalty_time: contest.penalty_time || 20
          },
          problems: problems.map((prob: any) => ({
            id: prob.id,
            label: prob.label,
            name: prob.name,
            color: prob.color || '#3498db',
            ordinal: prob.ordinal
          }))
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Fallback data
    return new Response(JSON.stringify({
      contest: {
        id: '2',
        name: 'KMITL Programming Contest',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        freeze_time: null,
        unfreeze_time: null,
        penalty_time: 20
      },
      problems: [
        { id: '15', label: 'A', name: 'Problem A', color: '#e74c3c', ordinal: 1 },
        { id: '14', label: 'B', name: 'Problem B', color: '#f39c12', ordinal: 2 },
        { id: '8', label: 'C', name: 'Problem C', color: '#f1c40f', ordinal: 3 },
        { id: '5', label: 'D', name: 'Problem D', color: '#2ecc71', ordinal: 4 },
        { id: '9', label: 'E', name: 'Problem E', color: '#3498db', ordinal: 5 },
        { id: '11', label: 'F', name: 'Problem F', color: '#9b59b6', ordinal: 6 },
        { id: '13', label: 'G', name: 'Problem G', color: '#1abc9c', ordinal: 7 },
        { id: '10', label: 'H', name: 'Problem H', color: '#34495e', ordinal: 8 }
      ]
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error fetching contest info:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch contest info' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
