import { getApiBaseUrl } from '$lib/config';

export const GET = async ({ fetch }: { fetch: any }) => {
  try {
    console.log('🔄 Fetching contest information...');
    
    // API Base URL - dynamically configured
    const API_BASE = getApiBaseUrl();
    console.log('🔗 Using API base URL:', API_BASE);
    
    // Get contest information with better error handling
    const contestsResponse = await fetch(`${API_BASE}/api/v4/contests`, {
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
        const problemsResponse = await fetch(`${API_BASE}/api/v4/contests/${contestId}/problems`, {
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
            name: contest.name || contest.formal_name || `Contest ${contest.id}`,
            formal_name: contest.formal_name,
            shortname: contest.shortname,
            start_time: contest.start_time,
            end_time: contest.end_time,
            freeze_time: contest.freeze_time,
            unfreeze_time: contest.unfreeze_time,
            penalty_time: contest.penalty_time || 20,
            duration: contest.duration,
            scoreboard_freeze_duration: contest.scoreboard_freeze_duration
          },
          problems: problems.map((prob: any) => ({
            id: prob.id,
            label: prob.label,
            name: prob.name,
            short_name: prob.short_name,
            color: prob.color || prob.rgb || '#3498db',
            rgb: prob.rgb,
            ordinal: prob.ordinal,
            time_limit: prob.time_limit
          }))
        };
        
        console.log('✅ Returning contest data:', contestData.contest.name);
        console.log('🧩 Returning problems:', contestData.problems.map(p => `${p.label}: ${p.name}`));
        
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
        id: '4',
        name: 'Code Arcade 2025: Stadium | Pro Round',
        formal_name: 'Code Arcade 2025: Stadium | Pro Round',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        freeze_time: null,
        unfreeze_time: null,
        penalty_time: 20
      },
      problems: [
        { id: '18', label: 'A', name: 'คำยาวยาวเชื่อมกันหน่อยยย', color: '#ff0000', ordinal: 0 },
        { id: '20', label: 'B', name: 'FreeRunning', color: '#5640ff', ordinal: 1 },
        { id: '24', label: 'C', name: 'Bouken Da Bouken', color: '#00ff04', ordinal: 2 },
        { id: '25', label: 'D', name: 'Broken Button', color: '#fc32ff', ordinal: 3 },
        { id: '21', label: 'E', name: 'เซค 2 หากลุ่มครับ', color: '#fcff63', ordinal: 4 },
        { id: '23', label: 'F', name: 'ใกล้แค่ไหนคือไกล', color: '#04fbff', ordinal: 5 }
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
