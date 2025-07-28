import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getApiBaseUrl } from '$lib/config';

// Get API Base URL from configuration
const API_BASE = getApiBaseUrl();

// ฟังก์ชันดึงข้อมูล organizations เพื่อให้ได้ logo URLs
async function getOrganizationsData(baseUrl: string, headers: Record<string, string>, fetch: any) {
  try {
    const orgsUrl = baseUrl.replace('/scoreboard', '/organizations');
    console.log('🏢 Fetching organizations from:', orgsUrl);
    
    const response = await fetch(orgsUrl, { 
      headers: {
        ...headers,
        'Accept': 'application/json',
        'User-Agent': 'SCQ-Scoreboard/1.0'
      },
      signal: AbortSignal.timeout(10000) // Increased timeout
    });
    
    if (response.ok) {
      const organizations = await response.json();
      console.log('✅ Organizations data loaded:', organizations.length);
      
      // สร้าง mapping จาก organization_id ไป logo data
      const orgMap: Record<string, any> = {};
      if (Array.isArray(organizations)) {
        organizations.forEach((org: any) => {
          orgMap[org.id] = {
            name: org.name,
            formal_name: org.formal_name,
            logo: org.logo
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

export const GET: RequestHandler = async ({ fetch }) => {
  console.log('🔗 Using API base URL:', API_BASE);

  // Fallback data structure
  const sampleTeams = [
    {
      rank: 1,
      team_id: '1',
      display_name: 'Sample Team 1',
      affiliation: 'KMITL',
      solved: 3,
      time: 180,
      score: { num_solved: 3, total_time: 180 },
      problems: [
        { problem_id: '1', num_judged: 1, num_pending: 0, solved: true, time: 30, first_to_solve: false },
        { problem_id: '2', num_judged: 2, num_pending: 0, solved: true, time: 90, first_to_solve: false },
        { problem_id: '3', num_judged: 1, num_pending: 0, solved: true, time: 180, first_to_solve: false }
      ]
    },
    {
      rank: 2,
      team_id: '2',
      display_name: 'Sample Team 2',
      affiliation: 'KMITL',
      solved: 2,
      time: 150,
      score: { num_solved: 2, total_time: 150 },
      problems: [
        { problem_id: '1', num_judged: 1, num_pending: 0, solved: true, time: 45, first_to_solve: false },
        { problem_id: '2', num_judged: 1, num_pending: 0, solved: true, time: 105, first_to_solve: false },
        { problem_id: '3', num_judged: 2, num_pending: 0, solved: false, time: 0, first_to_solve: false }
      ]
    }
  ];
  
  try {
    // Check if there are any contests first
    console.log('🔍 Checking for available contests...');
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
        
        // Use Basic Auth if available
        const username = env.DOMJUDGE_USERNAME;
        const password = env.DOMJUDGE_PASSWORD;
        
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'User-Agent': 'SCQ-Scoreboard/1.0'
        };
        
        if (username && password) {
          const auth = btoa(`${username}:${password}`);
          headers['Authorization'] = `Basic ${auth}`;
          console.log('🔐 Using Basic Auth with username:', username);
        }
        
        const apiUrl = `${API_BASE}/api/v4/contests/${contestId}/scoreboard?allteams=false&strict=false`;
        console.log('📊 Fetching scoreboard from:', apiUrl);
        
        const response = await fetch(apiUrl, {
          headers,
          signal: AbortSignal.timeout(15000) // Increased timeout for scoreboard
        });
        
        console.log('📈 Scoreboard response status:', response.status);
        
        if (response.ok) {
          const scoreboard = await response.json();
          console.log('✅ Scoreboard data loaded, teams:', scoreboard.rows?.length);
          
          // Get additional data for enhanced display
          const organizationsData = await getOrganizationsData(apiUrl, headers, fetch);
          const teamsData = await getTeamsData(apiUrl, headers, fetch);
          
          const teams = (scoreboard.rows || []).map((row: any, index: number) => ({
            rank: row.rank || index + 1,
            team_id: row.team_id,
            display_name: teamsData[row.team_id]?.display_name || row.team?.display_name || `Team ${row.team_id}`,
            affiliation: teamsData[row.team_id]?.affiliation || row.team?.affiliation || 'Unknown',
            solved: row.score?.num_solved || 0,
            time: row.score?.total_time || 0,
            score: row.score || { num_solved: 0, total_time: 0 },
            problems: row.problems || [],
            organization_id: teamsData[row.team_id]?.organization_id,
            logo_url: organizationsData[teamsData[row.team_id]?.organization_id]?.logo ? 
              `${API_BASE}/api/v4/${organizationsData[teamsData[row.team_id]?.organization_id].logo.href}` : null,
          }));
          
          console.log('🎉 Successfully processed', teams.length, 'teams');
          
          return new Response(JSON.stringify({ teams: teams.length > 0 ? teams : sampleTeams }), {
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } else {
          console.warn('⚠️ Failed to fetch scoreboard, using sample data');
          return json({ teams: sampleTeams });
        }
      } else {
        console.warn('⚠️ No contests found, using sample data');
        return json({ teams: sampleTeams });
      }
    } else {
      console.warn('⚠️ Failed to fetch contests, using sample data');
      return json({ teams: sampleTeams });
    }
    
  } catch (error) {
    console.error('💥 Error fetching scoreboard:', error);
  }
  
  return new Response(JSON.stringify({ teams: sampleTeams }), {
    status: 200, // Return 200 instead of 500 for fallback
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  });
};
