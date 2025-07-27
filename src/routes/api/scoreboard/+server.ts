import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

// ฟังก์ชันดึงข้อมูล organizations เพื่อให้ได้ logo URLs
async function getOrganizationsData(baseUrl: string, headers: Record<string, string>, fetch: any) {
  try {
    const orgsUrl = baseUrl.replace('/scoreboard', '/organizations');
    console.log('Fetching organizations from:', orgsUrl);
    
    const response = await fetch(orgsUrl, { 
      headers,
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      const organizations = await response.json();
      console.log('Organizations data:', organizations);
      
      // สร้าง mapping จาก organization_id ไป logo data
      const orgMap: Record<string, any> = {};
      if (Array.isArray(organizations)) {
        organizations.forEach((org: any) => {
          orgMap[org.id] = {
            name: org.name,
            formal_name: org.formal_name,
            shortname: org.shortname,
            logo: org.logo && org.logo.length > 0 ? org.logo[0] : null // เอา logo แรก
          };
        });
      }
      
      return orgMap;
    }
  } catch (error) {
    console.error('Error fetching organizations:', error);
  }
  
  return {};
}

// ฟังก์ชันดึงข้อมูลทีมเพื่อให้ได้ชื่อทีม
async function getTeamsData(baseUrl: string, headers: Record<string, string>, fetch: any) {
  try {
    const teamsUrl = baseUrl.replace('/scoreboard', '/teams');
    console.log('Fetching teams from:', teamsUrl);
    
    const response = await fetch(teamsUrl, { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const teams = await response.json();
      console.log('Teams data:', teams);
      
      // สร้าง mapping จาก team_id ไป team data
      const teamMap: Record<string, any> = {};
      if (Array.isArray(teams)) {
        teams.forEach((team: any) => {
          teamMap[team.id] = {
            name: team.name || `Team ${team.id}`,
            affiliation: team.affiliation || null,
            organization_id: team.organization_id || null,
            display_name: team.display_name || team.name
          };
        });
      }
      
      return teamMap;
    }
  } catch (error) {
    console.error('Error fetching teams:', error);
  }
  
  return {};
}

export const GET: RequestHandler = async ({ fetch }: { fetch: any }) => {
  // Sample data with KMITL teams
  const sampleTeams = [
    { name: "KMITL Algorithm Masters", score: 8, solved: 8 },
    { name: "KMITL Code Warriors", score: 7, solved: 7 },
    { name: "KMITL Debug Heroes", score: 6, solved: 6 },
    { name: "KMITL Binary Ninjas", score: 5, solved: 5 },
    { name: "KMITL Recursive Rebels", score: 4, solved: 4 },
    { name: "KMITL Data Structures", score: 3, solved: 3 },
    { name: "KMITL Graph Theorists", score: 2, solved: 2 }
  ];
  
  try {
    // Check if there are any contests first
    console.log('Checking for available contests...');
    const contestsResponse = await fetch('http://codearcade.cskmitl.com/api/v4/contests', {
      signal: AbortSignal.timeout(5000)
    });
    
    if (contestsResponse.ok) {
      const contests = await contestsResponse.json();
      console.log(`Found ${contests.length} contests`);
      
      if (contests.length === 0) {
        console.log('No active contests found, using sample data');
        return json({ teams: sampleTeams });
      }
      
      // Use the first available contest
    //   const contestId = contests[0].id;
            const contestId = 2;

      console.log(`Using contest ID: ${contestId}`);
      
      const apiUrl = `http://codearcade.cskmitl.com/api/v4/contests/${contestId}/scoreboard?allteams=false&strict=false`;
        //  const apiUrl = `http://codearcade.cskmitl.com/api/v4/contests/3/scoreboard?allteams=false&strict=false`;

      const username = env.DOMJUDGE_USERNAME;
      const password = env.DOMJUDGE_PASSWORD;
      
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'SCQ-Scoreboard/1.0',
        'Content-Type': 'application/json'
      };
      
      // Add authentication if available
      if (username && password) {
        const auth = btoa(`${username}:${password}`);
        headers['Authorization'] = `Basic ${auth}`;
      }
      
      console.log('Fetching from:', apiUrl);
      
      // Get teams data for name resolution
      const teamMap = await getTeamsData(apiUrl, headers, fetch);
      
      // Get organizations data for logo URLs
      const orgMap = await getOrganizationsData(apiUrl, headers, fetch);
      
      const response = await fetch(apiUrl, { 
        headers,
        signal: AbortSignal.timeout(10000)
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        console.log(`API returned ${response.status}, using sample data`);
        return json({ teams: sampleTeams });
      }

      const data = await response.json();
      console.log('Raw API data:', JSON.stringify(data, null, 2));
      
      // Transform DOMjudge API response
      let teams = [];
      
      if (data && data.rows && Array.isArray(data.rows)) {
        teams = data.rows.map((row: any) => {
          const teamData = teamMap[row.team_id];
          const orgData = teamData?.organization_id ? orgMap[teamData.organization_id] : null;
          
          return {
            name: teamData?.name || `Team ${row.team_id}`,
            display_name: teamData?.display_name || teamData?.name || `Team ${row.team_id}`,
            affiliation: teamData?.affiliation || null,
            organization_id: teamData?.organization_id || null,
            logo_url: orgData?.logo ? `http://codearcade.cskmitl.com/api/v4/${orgData.logo.href}` : null,
            score: row.score?.num_solved || 0,
            solved: row.score?.num_solved || 0,
            total_time: row.score?.total_time || 0,
            rank: row.rank || 0,
            team_id: row.team_id,
            // เพิ่มข้อมูล problems แต่ละข้อ
            problems: row.problems ? row.problems.map((prob: any, index: number) => ({
              label: prob.label,
              problem_id: prob.problem_id,
              solved: prob.solved || false,
              num_judged: prob.num_judged || 0,
              num_pending: prob.num_pending || 0,
              time: prob.time || 0,
              first_to_solve: prob.first_to_solve || false,
              attempts: prob.num_judged || 0
            })) : []
          };
        });
        
        // Sort by rank
        teams.sort((a: any, b: any) => a.rank - b.rank);
      }

      console.log('Processed teams:', teams);
      return json({ teams: teams.length > 0 ? teams : sampleTeams });
    }
    
  } catch (error) {
    console.error('Error fetching scoreboard:', error);
  }
  
  // Return sample data as fallback
  console.log('Using sample data as fallback');
  return json({ teams: sampleTeams });
};
