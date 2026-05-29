body {
  margin: 0;
  font-family: Arial;
  background: #070b14;
  color: white;
}

.container {
  width: 95%;
  margin: auto;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  color: #2d7dff;
}

.server-status {
  margin-top: 10px;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.tabs button {
  background: #111827;
  border: 1px solid #2d7dff;
  color: white;
  padding: 10px 20px;
  cursor: pointer;
}

.tabs button:hover {
  background: #2d7dff;
}

.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}
let excelData = {}
    <tr>
      <th>Rank</th>
      <th>Character</th>
      <th>Class</th>
      <th>Guild</th>
      <th>Score</th>
    </tr>
  `

  data.forEach((player) => {
    html += `
      <tr>
        <td>${player.rank}</td>
        <td>${player.character}</td>
        <td>${player.class}</td>
        <td>${player.guild}</td>
        <td>${player.score}</td>
      </tr>
    `
  })

  table.innerHTML = html
}

function renderGuildRanking() {
  const table = document.getElementById('guildTable')

  const data = excelData.guild_ranking || []

  let html = `
    <tr>
      <th>Rank</th>
      <th>Guild</th>
      <th>Leader</th>
      <th>Members</th>
      <th>Score</th>
      <th>Nation</th>
    </tr>
  `

  data.forEach((guild) => {
    html += `
      <tr>
        <td>${guild.rank}</td>
        <td>${guild.guild}</td>
        <td>${guild.leader}</td>
        <td>${guild.members}</td>
        <td>${guild.score}</td>
        <td>${guild.nation}</td>
      </tr>
    `
  })

  table.innerHTML = html
}

function renderWarStatus() {
  const container = document.getElementById('warContent')

  const data = excelData.bringer || []

  let html = ''

  data.forEach((player) => {
    html += `
      <div style="margin-bottom:20px;padding:15px;background:#111827;">
        <h3>${player.character}</h3>
        <p>${player.class}</p>
        <p>${player.nation}</p>
        <p>${player.war_level}</p>
      </div>
    `
  })

  container.innerHTML = html
}

function renderSaintsOwner() {
  const container = document.getElementById('saintsContent')

  const data = excelData.saints_owner || []

  let html = ''

  data.forEach((player) => {
    html += `
      <div style="margin-bottom:20px;padding:15px;background:#111827;">
        <h3>${player.character}</h3>
        <p>${player.class}</p>
        <p>${player.guild}</p>
        <p>Level ${player.level}</p>
      </div>
    `
  })

  container.innerHTML = html
}
table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255,255,255,0.05);
}

th,
td {
  border: 1px solid rgba(255,255,255,0.1);
  padding: 12px;
  text-align: left;
}

th {
  background: #1f2937;
}

.upload-box {
  margin-bottom: 20px;
}