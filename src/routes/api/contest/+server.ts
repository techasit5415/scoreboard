export const GET = async ({ fetch }: { fetch: any }) => {
  try {
    console.log('🔄 Fetching contest information...');
    
    // Get contest information with better error handling
    const contestsResponse = await fetch('http://codearcade.cskmitl.com/api/v4/contests', {
      signal: AbortSignal.timeout(10000), // Increased timeout
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SCQ-Scoreboard/1.0'
      }
    });
    
    console.log('📡 Contests response status:', contestsResponse.status);
    
    if (contestsResponse.ok) {
      const contests = await contestsResponse.json();
      console.log('🏆 Found contests:', contests.length);
      
      if (contests.length > 0) {
        const contest = contests[0];
        const contestId = contest.id;
        
        console.log('🎯 Using contest:', contestId, contest.name);
        
        // Get problems for this contest
        const problemsResponse = await fetch(`http://codearcade.cskmitl.com/api/v4/contests/${contestId}/problems`, {
          signal: AbortSignal.timeout(10000), // Increased timeout
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'SCQ-Scoreboard/1.0'
          }
        });
        
        console.log('🧩 Problems response status:', problemsResponse.status);
        
        let problems = [];
        if (problemsResponse.ok) {
          problems = await problemsResponse.json();
          console.log('✅ Found problems:', problems.length);
        } else {
          console.warn('⚠️ Failed to fetch problems, using fallback');
        }
        
        const contestData = {
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
        };
        
        console.log('✅ Returning contest data:', contestData.contest.name);
        return new Response(JSON.stringify(contestData), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } else {
        console.warn('⚠️ No contests found, using fallback');
      }
    } else {
      console.error('❌ Failed to fetch contests:', contestsResponse.status, contestsResponse.statusText);
    }
    
    // Fallback data
    console.log('🔄 Using fallback contest data');
    const fallbackData = {
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
    };
    
    console.log('✅ Returning fallback data');
    return new Response(JSON.stringify(fallbackData), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('💥 Error fetching contest info:', error);
    
    // Return fallback data even on error
    const errorFallbackData = {
      contest: {
        id: 'error',
        name: 'Contest (Error Fallback)',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        freeze_time: null,
        unfreeze_time: null,
        penalty_time: 20
      },
      problems: [
        { id: '1', label: 'A', name: 'Problem A', color: '#e74c3c', ordinal: 1 },
        { id: '2', label: 'B', name: 'Problem B', color: '#f39c12', ordinal: 2 },
        { id: '3', label: 'C', name: 'Problem C', color: '#f1c40f', ordinal: 3 },
        { id: '4', label: 'D', name: 'Problem D', color: '#2ecc71', ordinal: 4 }
      ]
    };
    
    return new Response(JSON.stringify(errorFallbackData), {
      status: 200, // Return 200 instead of 500 for fallback
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
