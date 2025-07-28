<script>
  import { fly, scale, fade } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';
  let teams = [];
  let contestInfo = null;
  let problems = [];
  let loading = true;
  let eventSource = null;
  let connectionStatus = 'connecting';
  let notifications = [];
  
  // New variables for enhanced features
  let contestTimer = null;
  let timeRemaining = 0;
  let contestStatus = 'unknown';
  let searchQuery = '';
  let filteredTeams = [];
  let selectedAffiliation = 'all';
  let sortColumn = 'rank';
  let sortDirection = 'asc';
  let showProblemStats = true;
  let currentTheme = 'dark';
  let totalSubmissions = 0;
  let problemStats = {};
  let firstToSolve = {};
  let showTeamDetails = false;
  let selectedTeam = null;
  let teamRankingAnimations = {}; // Track ranking animations

  // URLs
  const API_URL = '/api/scoreboard';
  const EVENT_FEED_URL = '/api/event-feed';
  const CONTEST_URL = '/api/contest';

  // Get team logo based on team data
  function getTeamLogo(team) {
    // ใช้ logo_url จาก API ถ้ามี
    if (team.logo_url) {
      return team.logo_url;
    }
    
    // Fallback: ใช้ affiliation เหมือนเดิม
    if (team.affiliation) {
      const affiliation = team.affiliation.toLowerCase();
      
      // KMITL และ King Mongkut's Institute
      if (affiliation.includes('kmitl') || 
          affiliation.includes('king mongkut') || 
          affiliation.includes('ladkrabang')) {
        return '/SCQ_logo.png';
      }
    }
    return null;
  }

  // Get team initial
  function getTeamInitial(team) {
    const name = team.display_name || team.name;
    return name.charAt(0).toUpperCase();
  }

  // Load contest information
  async function loadContestInfo() {
    try {
      console.log('🔄 Loading contest information...');
      const res = await fetch(CONTEST_URL);
      
      if (res.ok) {
        const data = await res.json();
        contestInfo = data.contest;
        problems = data.problems;
        
        // เรียงลำดับปัญหาตาม label (A, B, C, D, E, F, G, H)
        if (problems && problems.length > 0) {
          problems.sort((a, b) => a.label.localeCompare(b.label));
        }
        
        console.log('✅ Contest info loaded:', contestInfo?.name);
        console.log('🧩 Problems loaded (sorted):', problems?.length);
      } else {
        console.error('❌ Failed to load contest info:', res.status, res.statusText);
        // Set fallback data
        contestInfo = {
          id: 'fallback',
          name: 'Contest (Loading Failed)',
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
        };
        problems = [];
      }
    } catch (e) {
      console.error('💥 Error loading contest info:', e);
      addNotification('⚠️ Failed to load contest information', 'warning');
      // Set fallback data
      contestInfo = {
        id: 'error',
        name: 'Contest (Error)',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
      };
      problems = [];
    }
  }

  // Add notification
  function addNotification(message, type = 'info') {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date()
    };
    notifications = [notification, ...notifications.slice(0, 4)]; // Keep only 5 notifications
    
    // เล่นเสียงแจ้งเตือนสำหรับการแก้ปัญหาสำเร็จ
    if (type === 'success') {
      playNotificationSound();
    }
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notifications = notifications.filter(n => n.id !== notification.id);
    }, 5000);
  }

  // Play notification sound
  function playNotificationSound() {
    try {
      // สร้างเสียงแจ้งเตือนด้วย Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // เสียงแจ้งเตือนแบบ ding-dong
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }

  // Enhanced functions for new features
  
  // Contest timer
  function startContestTimer() {
    if (contestTimer) clearInterval(contestTimer);
    
    contestTimer = setInterval(() => {
      if (contestInfo) {
        const now = new Date();
        const start = new Date(contestInfo.start_time);
        const end = new Date(contestInfo.end_time);
        
        if (now < start) {
          contestStatus = 'not-started';
          timeRemaining = Math.floor((start - now) / 1000);
        } else if (now >= start && now < end) {
          contestStatus = 'running';
          timeRemaining = Math.floor((end - now) / 1000);
        } else {
          contestStatus = 'finished';
          timeRemaining = 0;
        }
      }
    }, 1000);
  }

  // Search and filter teams
  function filterTeams() {
    let result = teams;
    
    // Search by team name
    if (searchQuery.trim()) {
      result = result.filter(team => 
        (team.display_name || team.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.affiliation && team.affiliation.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Filter by affiliation
    if (selectedAffiliation !== 'all') {
      result = result.filter(team => team.affiliation === selectedAffiliation);
    }
    
    // Sort teams
    result.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortColumn) {
        case 'rank':
          aVal = a.rank || 999;
          bVal = b.rank || 999;
          break;
        case 'name':
          aVal = (a.display_name || a.name).toLowerCase();
          bVal = (b.display_name || b.name).toLowerCase();
          break;
        case 'solved':
          aVal = a.score?.num_solved || 0;
          bVal = b.score?.num_solved || 0;
          break;
        case 'score':
          aVal = a.score?.total_time || 0;
          bVal = b.score?.total_time || 0;
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
    
    filteredTeams = result;
  }

  // Calculate problem statistics
  function calculateProblemStats() {
    problemStats = {};
    firstToSolve = {};
    totalSubmissions = 0;
    
    problems.forEach(problem => {
      problemStats[problem.label] = {
        attempts: 0,
        solved: 0,
        successRate: 0,
        firstSolver: null,
        firstSolveTime: null
      };
    });
    
    teams.forEach(team => {
      if (team.problems) {
        team.problems.forEach(teamProblem => {
          const label = teamProblem.label;
          if (problemStats[label]) {
            problemStats[label].attempts += teamProblem.attempts || 0;
            totalSubmissions += teamProblem.attempts || 0;
            
            if (teamProblem.solved) {
              problemStats[label].solved++;
              
              // Check if this is the first solve
              if (!firstToSolve[label] || teamProblem.time < firstToSolve[label].time) {
                firstToSolve[label] = {
                  team: team.display_name || team.name,
                  time: teamProblem.time
                };
                problemStats[label].firstSolver = team.display_name || team.name;
                problemStats[label].firstSolveTime = teamProblem.time;
              }
            }
          }
        });
      }
    });
    
    // Calculate success rates
    Object.keys(problemStats).forEach(label => {
      const stat = problemStats[label];
      stat.successRate = stat.attempts > 0 ? (stat.solved / teams.length * 100) : 0;
    });
  }

  // Get unique affiliations for filter
  function getUniqueAffiliations() {
    const affiliations = new Set();
    teams.forEach(team => {
      if (team.affiliation) {
        affiliations.add(team.affiliation);
      }
    });
    return Array.from(affiliations).sort();
  }

  // Toggle theme
  function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
  }

  // Show team details modal
  function showTeamDetailsModal(team) {
    selectedTeam = team;
    showTeamDetails = true;
  }

  // Handle ranking animations
  function triggerRankingAnimation(teamId, oldRank, newRank) {
    if (oldRank === newRank) {
      teamRankingAnimations[teamId] = 'rank-same';
    } else if (newRank < oldRank) {
      teamRankingAnimations[teamId] = 'rank-up';
    } else {
      teamRankingAnimations[teamId] = 'rank-down';
    }
    
    // Clear animation after it completes
    setTimeout(() => {
      teamRankingAnimations[teamId] = '';
      teamRankingAnimations = {...teamRankingAnimations}; // Trigger reactivity
    }, 1000);
  }

  // Get ranking animation class
  function getRankingAnimationClass(teamId) {
    return teamRankingAnimations[teamId] || '';
  }

  // Format time helper
  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  // Get problem color
  function getProblemColor(problemLabel) {
    const problem = problems.find(p => p.label === problemLabel);
    return problem?.color || '#3498db';
  }

  // Convert CSS color names to hex/rgb values
  function convertColor(colorName) {
    const colorMap = {
      'black': '#000000',
      'gold': '#FFD700',
      'chartreuse': '#7FFF00',
      'springgreen': '#00FF7F',
      'aqua': '#00FFFF',
      'blue': '#0000FF',
      'fuchsia': '#FF00FF',
      'red': '#FF0000',
      'silver': '#C0C0C0',
      'purple': '#800080',
      'orange': '#FFA500',
      'green': '#008000'
    };
    return colorMap[colorName?.toLowerCase()] || colorName || '#3498db';
  }

  // เรียงลำดับปัญหาของทีมให้ตรงกับลำดับ problems
  function sortTeamProblems(teamProblems) {
    if (!problems || problems.length === 0 || !teamProblems) return teamProblems;
    
    // สร้าง map ของลำดับปัญหา
    const problemOrder = {};
    problems.forEach((problem, index) => {
      problemOrder[problem.label] = index;
    });
    
    // เรียงลำดับปัญหาของทีมตามลำดับ problems
    return teamProblems.sort((a, b) => {
      const aOrder = problemOrder[a.label] !== undefined ? problemOrder[a.label] : 999;
      const bOrder = problemOrder[b.label] !== undefined ? problemOrder[b.label] : 999;
      return aOrder - bOrder;
    });
  }

  // ดึงคะแนนจาก API (fallback)
  async function loadScoreboard() {
    try {
      console.log('🔄 Loading scoreboard data...');
      const res = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) {
        console.error('❌ Scoreboard API error:', res.status, res.statusText);
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      teams = data.teams || [];
      
      console.log('✅ Scoreboard loaded:', teams.length, 'teams');
      
      // เรียงลำดับทีมตาม rank จาก API
      teams.sort((a, b) => a.rank - b.rank);
      
      // เรียงลำดับปัญหาของแต่ละทีมให้ตรงกับลำดับ problems
      teams.forEach(team => {
        if (team.problems) {
          team.problems = sortTeamProblems(team.problems);
        }
      });
      
    } catch (e) {
      console.error('💥 Error loading scoreboard:', e);
      addNotification('⚠️ Failed to load scoreboard data', 'warning');
      
      // สร้างข้อมูลตัวอย่างเพื่อทดสอบ
      teams = [
        { 
          name: "KMITL Team 1", 
          display_name: "KMITL Team 1",
          score: { num_points: 450 }, 
          num_solved: 7,
          rank: 1,
          team_id: "1",
          affiliation: "KMITL",
          problems: []
        },
        { 
          name: "KMITL Team 2", 
          display_name: "KMITL Team 2",
          score: { num_points: 380 }, 
          num_solved: 6,
          rank: 2,
          team_id: "2",
          affiliation: "KMITL",
          problems: []
        },
        { 
          name: "KMITL Team 3", 
          display_name: "KMITL Team 3",
          score: { num_points: 320 }, 
          num_solved: 5,
          rank: 3,
          team_id: "3",
          affiliation: "KMITL",
          problems: []
        }
      ];
    }
    loading = false;
    
    // Update filtered teams and stats after loading
    filterTeams();
    calculateProblemStats();
  }

  // Real-time updates ด้วย Server-Sent Events
  function setupEventSource() {
    // ป้องกันการสร้าง EventSource ซ้ำ
    if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
      return;
    }
    
    console.log('Setting up EventSource...');
    connectionStatus = 'connecting';
    
    try {
      eventSource = new EventSource(EVENT_FEED_URL);
      
      eventSource.onopen = () => {
        console.log('EventSource connected');
        connectionStatus = 'connected';
      };
      
      eventSource.onmessage = (event) => {
        try {
          const eventData = JSON.parse(event.data);
          console.log('Received event:', eventData);
          
          if (eventData.type === 'scoreboard_update' && eventData.data) {
            // อัพเดท scoreboard ทันที
            const newTeams = eventData.data.teams || [];
            
            // เรียงลำดับทีมตาม rank จาก API
            newTeams.sort((a, b) => a.rank - b.rank);
            
            // เรียงลำดับปัญหาของแต่ละทีมให้ตรงกับลำดับ problems
            newTeams.forEach(team => {
              if (team.problems) {
                team.problems = sortTeamProblems(team.problems);
              }
            });
            
            // Check for ranking changes and new solutions
            if (teams.length > 0) {
              newTeams.forEach((newTeam, index) => {
                const oldTeam = teams.find(t => t.team_id === newTeam.team_id);
                if (oldTeam) {
                  // Check for new solutions - เปรียบเทียบแต่ละข้อ
                  if (newTeam.problems && oldTeam.problems) {
                    newTeam.problems.forEach(newProblem => {
                      const oldProblem = oldTeam.problems.find(p => p.problem_id === newProblem.problem_id || p.label === newProblem.label);
                      
                      // ตรวจสอบปัญหาที่แก้ได้ใหม่
                      if (newProblem.solved && (!oldProblem || !oldProblem.solved)) {
                        const problemName = newProblem.label;
                        const timeText = newProblem.time ? ` in ${formatTime(newProblem.time)}` : '';
                        const attemptsText = newProblem.num_judged > 1 ? ` (${newProblem.num_judged} attempts)` : '';
                        
                        if (newProblem.first_to_solve) {
                          addNotification(`👑 ${newTeam.name} is FIRST to solve problem ${problemName}!${timeText}${attemptsText}`, 'success');
                        } else {
                          addNotification(`🎉 ${newTeam.name} solved problem ${problemName}!${timeText}${attemptsText}`, 'success');
                        }
                      }
                      
                      // ตรวจสอบการส่งใหม่ (ยังไม่ผ่าน)
                      else if (!newProblem.solved && newProblem.num_judged > (oldProblem?.num_judged || 0)) {
                        const attemptsText = newProblem.num_judged === 1 ? 'first attempt' : `${newProblem.num_judged} attempts`;
                        addNotification(`❌ ${newTeam.name} failed problem ${newProblem.label} (${attemptsText})`, 'error');
                      }
                    });
                  }
                  
                  // Check for overall solved count change (fallback)
                  else if (newTeam.solved > oldTeam.solved) {
                    addNotification(`🎉 ${newTeam.name} solved a new problem! (${newTeam.solved} problems total)`, 'success');
                  }
                  
                  // Check for ranking changes
                  if (oldTeam.rank !== newTeam.rank) {
                    // Trigger ranking animation
                    triggerRankingAnimation(newTeam.team_id || newTeam.name, oldTeam.rank, newTeam.rank);
                    
                    if (newTeam.rank < oldTeam.rank) {
                      addNotification(`📈 ${newTeam.name} moved up to rank ${newTeam.rank}!`, 'info');
                    } else if (newTeam.rank > oldTeam.rank) {
                      addNotification(`📉 ${newTeam.name} moved down to rank ${newTeam.rank}`, 'warning');
                    }
                  }
                }
              });
            }
            
            teams = newTeams;
            loading = false;
            
            // Update filtered teams and stats after real-time update
            filterTeams();
            calculateProblemStats();
          }
        } catch (error) {
          console.error('Error parsing event data:', error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        connectionStatus = 'error';
        
        // ปิด EventSource ที่เกิดข้อผิดพลาด
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        
        // รอ 5 วินาทีแล้วลองเชื่อมต่อใหม่
        setTimeout(() => {
          console.log('Attempting to reconnect EventSource...');
          setupEventSource();
        }, 5000);
      };
      
    } catch (error) {
      console.error('Error creating EventSource:', error);
      connectionStatus = 'error';
      // Fallback to regular polling
      loadScoreboard();
      const timer = setInterval(loadScoreboard, 10000);
      return () => clearInterval(timer);
    }
  }

  // Initialize on mount
  onMount(async () => {
    // โหลดข้อมูล contest และ problems ก่อน
    await loadContestInfo();
    
    // Start contest timer
    startContestTimer();
    
    // Initialize theme
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    // ลองใช้ EventSource ก่อน
    // setupEventSource();
    
    // Fallback: โหลดข้อมูลครั้งแรกด้วย regular HTTP request
    await loadScoreboard();
    
    // Set connection status to connected since we're using polling
    connectionStatus = 'connected';
    
    // แจ้งเตือนการเชื่อมต่อ
    addNotification('🔗 Connected to scoreboard using polling!', 'info');
    
    // บังคับรีเฟรชข้อมูลทุก 5 วินาที (เร็วขึ้นอีก)
    const refreshInterval = setInterval(async () => {
      const now = new Date().toLocaleTimeString();
      console.log(`[${now}] Force refreshing scoreboard data...`);
      await loadScoreboard();
      
      // Debug: ตรวจสอบข้อมูลทีมและปัญหา
      console.log('=== API DATA DEBUG ===');
      console.log('Total teams:', teams.length);
      console.log('Total problems:', problems.length);
      console.log('Problems colors:', problems.map(p => ({ label: p.label, color: p.color })));
      teams.slice(0, 2).forEach((team, index) => {
        console.log(`Team ${index + 1}: ${team.name} (rank: ${team.rank})`);
        console.log('- Team problems data:', team.problems?.map(p => ({
          label: p.label,
          problem_id: p.problem_id,
          solved: p.solved,
          num_judged: p.num_judged,
          num_pending: p.num_pending,
          first_to_solve: p.first_to_solve
        })));
        console.log('- Contest problems:', problems.map(p => ({ label: p.label, id: p.id })));
        console.log('- Solved problems:', team.problems?.filter(p => p.solved).map(p => ({
          label: p.label,
          time: p.time,
          first_to_solve: p.first_to_solve
        })));
        console.log('- First solves:', team.problems?.filter(p => p.first_to_solve).map(p => p.label));
      });
      console.log('========================');
    }, 5000);
    
    // Cleanup interval on destroy
    return () => {
      clearInterval(refreshInterval);
    };
  });

  // Cleanup on destroy
  onDestroy(() => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (contestTimer) {
      clearInterval(contestTimer);
    }
  });

  // Reactive statements
  $: if (teams.length > 0) {
    filterTeams();
    calculateProblemStats();
  }

  $: uniqueAffiliations = getUniqueAffiliations();
</script>

<style>
  :global([data-theme="light"]) {
    --bg-primary: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    --bg-secondary: rgba(255,255,255,0.95);
    --text-primary: #212529;
    --text-secondary: #6c757d;
    --border-color: #dee2e6;
    --shadow-color: rgba(0,0,0,0.1);
  }

  :global([data-theme="dark"]) {
    --bg-primary: linear-gradient(135deg, #181a20 0%, #283048 100%);
    --bg-secondary: rgba(40,48,72,0.95);
    --text-primary: #fff;
    --text-secondary: #bbb;
    --border-color: rgba(255,255,255,0.2);
    --shadow-color: rgba(0,0,0,0.4);
  }

  .scoreboard-bg {
    background: var(--bg-primary);
    min-height: 100vh;
    padding: 2rem 0;
    font-family: 'Segoe UI', 'Roboto', 'Kanit', sans-serif;
    color: var(--text-primary);
  }

  /* Contest header styles */
  .contest-header {
    max-width: 1400px;
    margin: 0 auto 2rem;
    background: var(--bg-secondary);
    border-radius: 1rem;
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 4px 16px var(--shadow-color);
  }

  .contest-info {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .contest-timer {
    font-size: 1.8rem;
    font-weight: bold;
    color: #f39c12;
  }

  .contest-status {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: bold;
    text-transform: uppercase;
    font-size: 0.8rem;
  }

  .contest-status.running {
    background: #27ae60;
    color: white;
  }

  .contest-status.not-started {
    background: #f39c12;
    color: white;
  }

  .contest-status.finished {
    background: #e74c3c;
    color: white;
  }

  .controls {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .theme-toggle {
    background: none;
    border: 2px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 1.2rem;
    transition: all 0.3s ease;
  }

  .theme-toggle:hover {
    background: var(--border-color);
  }

  /* Search and filter styles */
  .filter-bar {
    max-width: 1400px;
    margin: 0 auto 2rem;
    background: var(--bg-secondary);
    border-radius: 1rem;
    padding: 1.5rem;
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
    box-shadow: 0 4px 16px var(--shadow-color);
  }

  .search-input, .filter-select {
    padding: 0.75rem 1rem;
    border: 2px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    outline: none;
    transition: border-color 0.3s ease;
  }

  .search-input:focus, .filter-select:focus {
    border-color: #3498db;
  }

  .search-input {
    flex: 1;
    min-width: 300px;
  }

  .filter-select {
    min-width: 150px;
  }

  .stats-toggle {
    background: #3498db;
    color: white;
    border: none;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.3s ease;
  }

  .stats-toggle:hover {
    background: #2980b9;
  }

  /* Problem statistics panel */
  .problem-stats {
    max-width: 1400px;
    margin: 0 auto 2rem;
    background: var(--bg-secondary);
    border-radius: 1rem;
    padding: 1.5rem;
    box-shadow: 0 4px 16px var(--shadow-color);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    background: var(--bg-primary);
    padding: 1rem;
    border-radius: 0.5rem;
    border-left: 4px solid;
    text-align: center;
  }

  .stat-card h4 {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    color: var(--text-secondary);
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }

  .stat-detail {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .title {
    color: var(--text-primary);
    text-align: center;
    font-size: 2.6rem;
    margin-bottom: 2rem;
    letter-spacing: 2px;
    font-weight: bold;
    text-shadow: 0 2px 20px var(--shadow-color);
  }
  .scoreboard {
    max-width: 1400px;
    margin: 0 auto;
    border-radius: 1.5rem;
    box-shadow: 0 6px 32px var(--shadow-color);
    background: var(--bg-secondary);
    overflow: hidden;
  }

  .scoreboard-header {
    background: var(--bg-primary);
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    font-weight: bold;
    color: var(--text-primary);
    border-bottom: 2px solid var(--border-color);
  }

  .header-item {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: color 0.3s ease;
  }

  .header-item:hover {
    color: #3498db;
  }

  .sort-icon {
    font-size: 0.8rem;
    opacity: 0.7;
  }

  .team-row {
    display: flex;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    transition: all 0.3s ease;
    position: relative;
    z-index: 2;
    gap: 1rem;
    min-height: 4rem;
    cursor: pointer;
  }

  .team-row:hover {
    background: var(--bg-primary);
    transform: translateX(5px);
  }
  
  .team-info-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
    min-width: 200px;
    max-width: 400px;
  }
  
  .team-logo {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.9);
    padding: 2px;
    cursor: pointer;
  }
  
  .team-logo-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.2rem;
    color: white;
    border: 2px solid rgba(255,255,255,0.3);
    cursor: pointer;
  }
  
  .team-logo-placeholder.kmitl {
    background: linear-gradient(135deg, #1e3a5f 0%, #2c5aa0 100%);
    border-color: #ffd700;
  }
  
  .team-info-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  
  .team-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.2rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  
  .team-affiliation {
    font-size: 0.8rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .last-submission {
    font-size: 0.75rem;
    color: #3498db;
    margin-top: 0.2rem;
  }

  .rank {
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--text-primary);
  }

  .rank.gold {
    color: #ffd700;
    text-shadow: 0 0 10px #ffd700;
  }

  .rank.silver {
    color: #c0c0c0;
    text-shadow: 0 0 10px #c0c0c0;
  }

  .rank.bronze {
    color: #cd7f32;
    text-shadow: 0 0 10px #cd7f32;
  }

  .team-logo {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border-color);
    transition: transform 0.3s ease;
  }

  .team-logo:hover {
    transform: scale(1.1);
  }
  
  .team-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.2rem;
    color: white;
    border: 2px solid var(--border-color);
    transition: transform 0.3s ease;
  }

  .team-avatar:hover {
    transform: scale(1.1);
  }

  .solved-count {
    font-size: 1.2rem;
    font-weight: bold;
    color: #27ae60;
  }

  .score {
    font-size: 1.1rem;
    font-weight: bold;
    color: var(--text-primary);
  }

  .penalty-time {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-top: 0.2rem;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top: 3px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .no-teams {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
  }
  
  .team-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-right: 1rem;
    flex-shrink: 0;
  }
  .team-row:hover {
    background: rgba(255,255,255,0.05);
    transform: translateY(-1px);
  }
  .team-row.top1 {
    background: linear-gradient(90deg, #ffe259 0%, #ffa751 100%);
    color: #222;
    font-weight: bold;
    font-size: 1.3rem;
    z-index: 5;
    box-shadow: 0 2px 24px #ffe25955 inset;
  }
  .team-row.top2 {
    background: linear-gradient(90deg, #e0eafc 0%, #cfdef3 100%);
    color: #333;
    font-weight: bold;
  }
  .team-row.top3 {
    background: linear-gradient(90deg, #f7971e 0%, #ffd200 100%);
    color: #222;
    font-weight: bold;
  }
  .team-row:last-child {
    border-bottom: none;
  }
  .rank {
    width: 3rem;
    text-align: center;
    font-size: 1.3rem;
    font-weight: bold;
    opacity: 0.9;
    flex-shrink: 0;
  }
  .score {
    width: 4rem;
    text-align: center;
    font-size: 1.2rem;
    font-weight: bold;
    color: #39ffb4;
    text-shadow: 0 1px 2px #0006;
    transition: color 0.3s;
    flex-shrink: 0;
  }
  .solved {
    width: 3rem;
    text-align: center;
    font-size: 0.9rem;
    color: #ffd700;
    opacity: 0.8;
    flex-shrink: 0;
  }
  
  /* Problem cells */
  .problem-cell {
    width: 3.5rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    position: relative;
    font-size: 0.8rem;
    border: 1px solid #fff2;
    margin: 0 0.1rem;
    flex-shrink: 0;
  }
  
  .problem-status {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    transition: all 0.3s ease;
    position: relative;
    cursor: pointer;
  }
  
  .problem-status:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }
  
  .problem-status.solved {
    color: white !important;
    text-shadow: 0 1px 2px #0006;
    box-shadow: 0 3px 10px rgba(0,230,118,0.6) !important;
    background: linear-gradient(135deg, #00e676 0%, #4caf50 100%) !important;
  }
  
  .problem-status.attempted {
    background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);
    color: white;
    text-shadow: 0 1px 2px #0006;
    box-shadow: 0 3px 10px rgba(231,76,60,0.4);
  }
  
  .problem-status.pending {
    background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
    color: white;
    text-shadow: 0 1px 2px #0006;
    box-shadow: 0 3px 10px rgba(52,152,219,0.4);
    animation: pulse 2s infinite;
  }
  
  .problem-status.empty {
    background: rgba(255,255,255,0.05);
    border: 2px dashed #fff3;
    color: #fff5;
    position: relative;
  }
  
  .problem-status.empty::before {
    content: attr(data-problem-label);
    position: absolute;
    font-size: 0.7rem;
    font-weight: bold;
    color: rgba(255,255,255,0.3);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  .solve-time {
    font-size: 0.75rem;
    font-weight: bold;
    line-height: 1;
    margin-bottom: 0.1rem;
  }
  
  .attempts {
    font-size: 0.65rem;
    opacity: 0.9;
    line-height: 1;
    font-weight: 600;
  }
  
  .pending {
    font-size: 0.75rem;
    font-weight: bold;
    line-height: 1;
    animation: bounce 1s infinite;
  }
  
  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-3px); }
    60% { transform: translateY(-1px); }
  }
  .score.animating {
    animation: pop 0.6s cubic-bezier(.23,1.05,.55,1.01);
  }
  @keyframes pop {
    0% { color: #fff; transform: scale(1);}
    20% { color: #39ffb4; transform: scale(1.25);}
    100% { color: #39ffb4; transform: scale(1);}
  }
  
  /* Connection status indicator */
  .connection-status {
    position: fixed;
    top: 1rem;
    right: 1rem;
    padding: 0.5rem 1rem;
    border-radius: 1rem;
    font-size: 0.8rem;
    font-weight: bold;
    color: white;
    z-index: 100;
    transition: all 0.3s;
  }
  .connection-status.connecting {
    background: #ffa500;
  }
  .connection-status.connected {
    background: #4caf50;
  }
  .connection-status.error {
    background: #f44336;
  }
  
  /* Contest header */
  .contest-header {
    background: rgba(255,255,255,0.1);
    padding: 1rem 2rem;
    margin-bottom: 2rem;
    border-radius: 1rem;
    backdrop-filter: blur(10px);
    text-align: center;
  }
  
  .contest-name {
    font-size: 1.8rem;
    color: #fff;
    margin-bottom: 0.5rem;
    font-weight: bold;
  }
  
  .contest-time {
    color: #bbb;
    font-size: 1rem;
  }
  
  /* Problems header */
  .problems-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);
    border-bottom: 2px solid #fff2;
    backdrop-filter: blur(5px);
  }
  
  .problems-labels {
    display: flex;
    gap: 0.3rem;
    margin-left: 1rem;
  }
  
  .problems-header::before {
    content: 'Teams & Problems';
    font-size: 0.9rem;
    color: #fff8;
    font-weight: 600;
    letter-spacing: 1px;
    margin-right: auto;
  }
  
  .problem-header {
    width: 3.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: white;
    font-size: 1rem;
    text-shadow: 0 1px 3px #0008;
    border: 2px solid rgba(255,255,255,0.2);
    background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
    cursor: pointer;
  }
  
  .problem-header:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    border-color: rgba(255,255,255,0.4);
  }
  
  /* Responsive design */
  @media (max-width: 1200px) {
    .scoreboard {
      max-width: 95%;
      margin: 0 auto;
    }
    
    .team-name {
      max-width: 200px;
    }
    
    .problem-cell {
      width: 3rem;
      height: 2.8rem;
    }
    
    .problem-header {
      width: 3rem;
      height: 2.3rem;
      font-size: 0.9rem;
    }
  }
  
  @media (max-width: 768px) {
    .team-row {
      padding: 0.6rem 1rem;
      gap: 0.3rem;
    }
    
    .team-name {
      font-size: 0.9rem;
      max-width: 150px;
    }
    
    .problem-cell {
      width: 2.5rem;
      height: 2.5rem;
      margin: 0 0.05rem;
    }
    
    .problem-header {
      width: 2.5rem;
      height: 2rem;
      font-size: 0.8rem;
      margin: 0 0.05rem;
    }
    
    .solve-time {
      font-size: 0.65rem;
    }
    
    .attempts {
      font-size: 0.55rem;
    }
  }
  
  /* Loading and transitions */
  .team-row.loading {
    opacity: 0.5;
    pointer-events: none;
  }
  
  .fade-in {
    animation: fadeIn 0.5s ease-in;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  /* Scrollbar styling */
  .scoreboard::-webkit-scrollbar {
    width: 8px;
  }
  
  .scoreboard::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
  }
  
  .scoreboard::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.3);
    border-radius: 4px;
  }
  
  /* Tooltip */
  .problem-status::before {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.9);
    color: white;
    padding: 0.5rem 0.8rem;
    border-radius: 0.3rem;
    font-size: 0.75rem;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s;
    z-index: 1000;
    margin-bottom: 0.5rem;
  }
  
  .problem-status:hover::before {
    opacity: 1;
  }
  
  /* First to solve indicator */
  .problem-status.first-solve::after {
    content: '👑';
    position: absolute;
    top: -0.3rem;
    right: -0.3rem;
    font-size: 0.8rem;
    background: #ffd700;
    border-radius: 50%;
    width: 1rem;
    height: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    z-index: 10;
  }
  
  .problem-status.first-solve {
    background: linear-gradient(45deg, #FFD700, #FFA500) !important;
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.8) !important;
    animation: crown-glow 2s infinite alternate;
    border: 2px solid #FFD700 !important;
  }
  
  @keyframes crown-glow {
    0% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.6); }
    100% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.9); }
  }
  
  /* Statistics panel */
  .stats-panel {
    background: rgba(255,255,255,0.05);
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #fff2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
    color: #fff8;
  }
  
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
  }
  
  .stat-value {
    font-size: 1.2rem;
    font-weight: bold;
    color: #39ffb4;
  }
  
  .stat-label {
    font-size: 0.8rem;
    opacity: 0.8;
  }
  
  /* Enhanced team row */
  .team-row {
    display: flex;
    align-items: center;
    padding: 1rem 2rem;
    border-bottom: 1px solid #fff3;
    transition: all 0.3s;
    position: relative;
    z-index: 2;
  }
  
  .team-info {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
  }
  
  .problems-row {
    display: flex;
    gap: 0.3rem;
    margin-left: 1rem;
  }
  
  .problem-cell.solved {
    background: linear-gradient(135deg, #00e676 0%, #4caf50 100%) !important;
    color: white !important;
    box-shadow: 0 2px 8px rgba(76,175,80,0.4) !important;
  }
  
  .problem-cell.attempted {
    background: #e74c3c !important;
    color: white !important;
    box-shadow: 0 2px 8px #e74c3c33 !important;
  }
  
  .problem-cell.pending {
    background: #3498db !important;
    color: white !important;
    animation: pulse 2s infinite;
    box-shadow: 0 2px 8px rgba(52, 152, 219, 0.4) !important;
  }
  
  .problem-cell.first-solve {
    background: linear-gradient(45deg, #f1c40f, #f39c12) !important;
    animation: glow 2s infinite alternate;
    box-shadow: 0 2px 8px rgba(241, 196, 15, 0.4) !important;
  }
  
  .problem-attempts {
    font-weight: bold;
    font-size: 0.85rem;
    line-height: 1;
  }

  .problem-time {
    font-size: 0.7rem;
    opacity: 0.9;
    line-height: 1;
    margin-top: 0.1rem;
  }

  .problem-cell {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.3rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: bold;
    position: relative;
    transition: all 0.2s;
    gap: 0.1rem;
  }
  
  /* Notifications */
  .notifications {
    position: fixed;
    top: 4rem;
    right: 1rem;
    z-index: 1000;
    max-width: 300px;
  }
  
  .notification {
    background: rgba(0,0,0,0.9);
    color: white;
    padding: 0.8rem 1rem;
    margin-bottom: 0.5rem;
    border-radius: 0.5rem;
    border-left: 4px solid;
    font-size: 0.9rem;
    backdrop-filter: blur(10px);
    animation: slideIn 0.3s ease-out;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  
  .notification-content {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  
  .notification-message {
    font-weight: 500;
    line-height: 1.3;
  }
  
  .notification-time {
    font-size: 0.75rem;
    opacity: 0.7;
    font-family: monospace;
  }
  
  .notification.success {
    border-left-color: #2ecc71;
  }
  
  .notification.info {
    border-left-color: #3498db;
  }
  
  .notification.warning {
    border-left-color: #f39c12;
  }
  
  .notification.error {
    border-left-color: #e74c3c;
  }
  
  /* Statistics panel */
  .stats-panel {
    background: rgba(255,255,255,0.05);
    padding: 1rem 2rem;
    border-bottom: 1px solid #fff3;
    display: flex;
    justify-content: space-around;
    font-size: 0.9rem;
    color: #bbb;
  }
  
  .stat-item {
    text-align: center;
  }
  
  .stat-value {
    font-size: 1.5rem;
    font-weight: bold;
    color: #fff;
    display: block;
  }
  
  /* Animations */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  @keyframes glow {
    0% { box-shadow: 0 2px 8px #f1c40f33; }
    100% { box-shadow: 0 4px 16px #f1c40f66; }
  }

  @keyframes crown-glow {
    0% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.8); }
    100% { box-shadow: 0 0 25px rgba(255, 215, 0, 1), 0 0 35px rgba(255, 215, 0, 0.6); }
  }
  
  /* Ranking change animations */
  .rank-up {
    animation: rankUp 1s ease-out;
    color: #27ae60 !important;
  }

  .rank-down {
    animation: rankDown 1s ease-out;
    color: #e74c3c !important;
  }

  .rank-same {
    animation: rankPulse 0.5s ease-out;
  }

  @keyframes rankUp {
    0% { 
      transform: translateY(10px) scale(1.2);
      color: #27ae60;
      text-shadow: 0 0 20px #27ae60;
    }
    50% {
      transform: translateY(-5px) scale(1.1);
    }
    100% { 
      transform: translateY(0) scale(1);
      color: #27ae60;
    }
  }

  @keyframes rankDown {
    0% { 
      transform: translateY(-10px) scale(1.2);
      color: #e74c3c;
      text-shadow: 0 0 20px #e74c3c;
    }
    50% {
      transform: translateY(5px) scale(1.1);
    }
    100% { 
      transform: translateY(0) scale(1);
      color: #e74c3c;
    }
  }

  @keyframes rankPulse {
    0% { 
      transform: scale(1);
    }
    50% {
      transform: scale(1.15);
      text-shadow: 0 0 15px currentColor;
    }
    100% { 
      transform: scale(1);
    }
  }

  /* Team row animation for ranking changes */
  .team-row.rank-changed {
    animation: rowHighlight 2s ease-out;
  }

  @keyframes rowHighlight {
    0% {
      background: rgba(255, 193, 7, 0.3);
      transform: scale(1.02);
      box-shadow: 0 4px 20px rgba(255, 193, 7, 0.4);
    }
    50% {
      background: rgba(255, 193, 7, 0.15);
    }
    100% {
      background: transparent;
      transform: scale(1);
      box-shadow: none;
    }
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  /* Team details modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
  }

  .modal-content {
    background: var(--bg-secondary);
    border-radius: 1rem;
    padding: 2rem;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    color: var(--text-primary);
    animation: slideUp 0.3s ease;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--border-color);
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.5rem;
    border-radius: 0.25rem;
    transition: background 0.3s ease;
  }

  .modal-close:hover {
    background: var(--border-color);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(50px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .contest-header {
      flex-direction: column;
      gap: 1rem;
    }

    .filter-bar {
      flex-direction: column;
      align-items: stretch;
    }

    .search-input {
      min-width: auto;
    }

    .team-row {
      padding: 0.75rem 1rem;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .problems-row {
      margin-left: 0;
      flex-wrap: wrap;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

<div class="scoreboard-bg">
  <!-- Connection Status Indicator -->
  <div class="connection-status {connectionStatus}">
    {#if connectionStatus === 'connecting'}
      🔄 Connecting...
    {:else if connectionStatus === 'connected'}
      🟢 Live
    {:else if connectionStatus === 'error'}
      🔴 Offline
    {/if}
  </div>
  
  <!-- Notifications -->
  <div class="notifications">
    {#each notifications as notification (notification.id)}
      <div class="notification {notification.type}" in:fly={{ x: 100, duration: 300 }} out:fade>
        <div class="notification-content">
          <div class="notification-message">{notification.message}</div>
          <div class="notification-time">
            {notification.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>
    {/each}
  </div>
  
  <div class="title" in:fly={{ y: -50, duration: 500 }}>
    {contestInfo?.name || 'DOMjudge Scoreboard'}
  </div>
  
  <!-- Contest Header with Timer and Controls -->
  {#if contestInfo}
    <div class="contest-header" in:scale>
      <div class="contest-info">
        <div class="contest-timer">
          {#if contestStatus === 'not-started'}
            ⏳ Starts in: {formatTime(timeRemaining)}
          {:else if contestStatus === 'running'}
            ⏱️ Time left: {formatTime(timeRemaining)}
          {:else if contestStatus === 'finished'}
            🏁 Contest Finished
          {:else}
            📊 Contest Status Unknown
          {/if}
        </div>
        <div class="contest-status {contestStatus}">
          {contestStatus.replace('-', ' ')}
        </div>
        <div class="contest-stats">
          <span>📊 {totalSubmissions} submissions</span>
          <span>👥 {teams.length} teams</span>
          <span>🧩 {problems.length} problems</span>
        </div>
      </div>
      <div class="controls">
        <button class="theme-toggle" on:click={toggleTheme}>
          {currentTheme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Filter and Search Bar -->
  <div class="filter-bar" in:scale>
    <input 
      class="search-input" 
      type="text" 
      placeholder="🔍 Search teams or affiliations..." 
      bind:value={searchQuery}
    />
    <select class="filter-select" bind:value={selectedAffiliation}>
      <option value="all">All Affiliations</option>
      {#each uniqueAffiliations as affiliation}
        <option value={affiliation}>{affiliation}</option>
      {/each}
    </select>
    <button class="stats-toggle" on:click={() => showProblemStats = !showProblemStats}>
      {showProblemStats ? '📊 Hide Stats' : '📈 Show Stats'}
    </button>
  </div>

  <!-- Problem Statistics Panel -->
  {#if showProblemStats && problems.length > 0}
    <div class="problem-stats" in:scale>
      <h3 style="margin: 0 0 1rem; color: var(--text-primary);">📊 Problem Statistics</h3>
      <div class="stats-grid">
        {#each problems as problem}
          <div class="stat-card" style="border-left-color: {convertColor(problem.color)};">
            <h4>Problem {problem.label}</h4>
            <div class="stat-value" style="color: {convertColor(problem.color)};">
              {problemStats[problem.label]?.solved || 0}/{teams.length}
            </div>
            <div class="stat-detail">
              {Math.round(problemStats[problem.label]?.successRate || 0)}% success rate<br>
              {problemStats[problem.label]?.attempts || 0} attempts<br>
              {#if firstToSolve[problem.label]}
                👑 First: {firstToSolve[problem.label].team}
              {:else}
                🚫 Unsolved
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
  
  <div class="scoreboard" in:scale>
    <!-- Sortable Header -->
    <div class="scoreboard-header">
      <div class="header-item" style="width: 60px;" on:click={() => {sortColumn = 'rank'; sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'}}>
        Rank 
        {#if sortColumn === 'rank'}
          <span class="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        {/if}
      </div>
      <div class="header-item" style="width: 80px;">Team</div>
      <div class="header-item" style="flex: 1;" on:click={() => {sortColumn = 'name'; sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'}}>
        Name 
        {#if sortColumn === 'name'}
          <span class="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        {/if}
      </div>
      <div class="header-item" style="width: 80px;" on:click={() => {sortColumn = 'solved'; sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'}}>
        Solved 
        {#if sortColumn === 'solved'}
          <span class="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        {/if}
      </div>
      <div class="header-item" style="width: 100px;" on:click={() => {sortColumn = 'score'; sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'}}>
        Score 
        {#if sortColumn === 'score'}
          <span class="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        {/if}
      </div>
      <div class="header-item" style="flex: 2;">Problems</div>
    </div>
    <!-- Team rows -->
    {#if loading}
      <div class="loading" in:scale>
        <div class="loading-spinner"></div>
        <div style="margin-top: 1rem; color: var(--text-secondary);">Loading scoreboard...</div>
      </div>
    {:else}
      {#each filteredTeams as team, index (team.team_id || index)}
        <div class="team-row {getRankingAnimationClass(team.team_id || team.name) ? 'rank-changed' : ''}" 
             in:fly="{{ y: 50, duration: 300, delay: index * 50 }}" 
             on:click={() => showTeamDetailsModal(team)}>
          
          <!-- Rank -->
          <div style="width: 60px; text-align: center;">
            <div class="rank {getRankingAnimationClass(team.team_id || team.name)}" 
                 class:gold={team.rank === 1} 
                 class:silver={team.rank === 2} 
                 class:bronze={team.rank === 3}>
              {team.rank || '—'}
            </div>
          </div>
          
          <!-- Team Logo/Avatar -->
          <div style="width: 80px; display: flex; justify-content: center;">
            {#if getTeamLogo(team)}
              <img src={getTeamLogo(team)} alt="{team.display_name || team.name}" class="team-logo" />
            {:else}
              <div class="team-avatar">
                {getTeamInitial(team)}
              </div>
            {/if}
          </div>
          
          <!-- Team Info Section -->
          <div class="team-info-section" style="flex: 1;">
            <div class="team-name">
              {team.display_name || team.name}
            </div>
            <div class="team-affiliation">
              {team.affiliation || 'Unknown Affiliation'}
            </div>
            {#if team.last_problem_time}
              <div class="last-submission">
                Last: {formatTime(team.last_problem_time)}
              </div>
            {/if}
          </div>
          
          <!-- Solved Problems Count -->
          <div style="width: 80px; text-align: center;">
            <div class="solved-count">
              {team.score?.num_solved || 0}
            </div>
          </div>
          
          <!-- Score -->
          <div style="width: 100px; text-align: center;">
            <div class="score">
              {team.score?.total_time || 0}
            </div>
            {#if team.score?.total_time}
              <div class="penalty-time">
                ({formatTime(team.score.total_time)})
              </div>
            {/if}
          </div>
          
          <!-- Problems -->
          <div class="problems-row" style="flex: 2;">
            {#each problems as problem}
              {@const teamProblem = team.problems?.find(p => p.label === problem.label)}
              {@const problemColor = convertColor(problem.color)}
              
              <div class="problem-cell" 
                   style={teamProblem?.solved || teamProblem?.num_pending > 0 || (teamProblem && !teamProblem.solved && teamProblem.num_judged > 0) || teamProblem?.first_to_solve ? "" : "background-color: " + problemColor + "33; border: 2px solid " + problemColor + ";"}
                   class:solved={teamProblem?.solved}
                   class:attempted={teamProblem && !teamProblem.solved && (teamProblem.num_judged > 0)}
                   class:pending={teamProblem?.num_pending > 0}
                   class:first-solve={teamProblem?.first_to_solve}
                   data-tooltip="{problem.label}: {teamProblem?.num_judged || 0} attempts">
                
                {#if teamProblem?.solved}
                  <div class="problem-attempts">{teamProblem.num_judged || 0}</div>
                  <div class="problem-time">{formatTime(teamProblem.time)}</div>
                {:else if teamProblem?.num_judged > 0}
                  <div class="problem-attempts">-{teamProblem.num_judged}</div>
                {:else if teamProblem?.num_pending > 0}
                  <div class="problem-attempts">?</div>
                {:else}
                  <div class="problem-attempts">—</div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
      
      {#if filteredTeams.length === 0 && !loading}
        <div class="no-teams" in:scale>
          <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            {#if searchQuery || selectedAffiliation !== 'all'}
              📭 No teams match your search criteria
            {:else}
              📭 No teams available
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Team Details Modal -->
{#if showTeamDetails && selectedTeam}
  <div class="modal-overlay" on:click={() => showTeamDetails = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2 style="margin: 0; display: flex; align-items: center; gap: 1rem;">
          {#if getTeamLogo(selectedTeam)}
            <img src={getTeamLogo(selectedTeam)} alt="{selectedTeam.display_name || selectedTeam.name}" 
                 style="width: 40px; height: 40px; border-radius: 50%;" />
          {:else}
            <div class="team-avatar" style="width: 40px; height: 40px; font-size: 1.2rem;">
              {getTeamInitial(selectedTeam)}
            </div>
          {/if}
          {selectedTeam.display_name || selectedTeam.name}
        </h2>
        <button class="modal-close" on:click={() => showTeamDetails = false}>✕</button>
      </div>
      
      <div class="team-details">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
          <div>
            <strong>Rank:</strong> #{selectedTeam.rank || '—'}
          </div>
          <div>
            <strong>Solved:</strong> {selectedTeam.score?.num_solved || 0} problems
          </div>
          <div>
            <strong>Score:</strong> {selectedTeam.score?.total_time || 0}
          </div>
          <div>
            <strong>Penalty:</strong> {formatTime(selectedTeam.score?.total_time || 0)}
          </div>
          <div style="grid-column: 1 / -1;">
            <strong>Affiliation:</strong> {selectedTeam.affiliation || 'Unknown'}
          </div>
        </div>
        
        <h3 style="margin-bottom: 1rem; color: var(--text-primary);">Problem Details</h3>
        <div style="display: grid; gap: 0.5rem;">
          {#each problems as problem}
            {@const teamProblem = selectedTeam.problems?.find(p => p.label === problem.label)}
            {@const problemColor = convertColor(problem.color)}
            
            <div style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem;">
              <div style="width: 40px; height: 40px; background: {problemColor}; color: white; border-radius: 0.25rem; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                {problem.label}
              </div>
              <div style="flex: 1;">
                <div style="font-weight: bold; margin-bottom: 0.25rem;">
                  Problem {problem.label}
                  {#if teamProblem?.first_to_solve}
                    <span style="color: #ffd700;">👑 First to solve!</span>
                  {/if}
                </div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">
                  {#if teamProblem?.solved}
                    ✅ Solved in {formatTime(teamProblem.time)} with {teamProblem.attempts || 0} attempts
                  {:else if teamProblem?.attempts > 0}
                    ❌ {teamProblem.attempts} failed attempts
                    {#if teamProblem.num_pending > 0}
                      • {teamProblem.num_pending} pending
                    {/if}
                  {:else if teamProblem?.num_pending > 0}
                    ⏳ {teamProblem.num_pending} pending submissions
                  {:else}
                    ⚪ Not attempted
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}