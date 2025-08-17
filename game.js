/* game.js (upgraded with milestone logic)
   - previous code base (bots, foods, joystick, rendering) updated
   - milestone trigger every time player's score reaches multiple of 100
*/

/* ====== Setup & Constants ====== */
const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const scoreEl = document.getElementById('score')
const milestoneOverlay = document.getElementById('milestone-overlay')
const milestoneText = document.getElementById('milestone-text')

let DPR = Math.max(1, window.devicePixelRatio || 1)
function resizeCanvas() {
	canvas.width = Math.floor(canvas.clientWidth * DPR)
	canvas.height = Math.floor(canvas.clientHeight * DPR)
	ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
}
window.addEventListener('resize', resizeCanvas)
resizeCanvas()

/* World settings & tuneable params */
let TILE = 20 // px per logical tile
let SEGMENT = 14 // segment diameter px (base)
const INITIAL_LENGTH = 9
let SPAWN_RADIUS = 30 // tiles distance for initial foods
const FOOD_COUNT = 24
let BOT_COUNT = 30 // number of bots
const MAX_ORBS_ON_DEATH = 30

/* Game state */
let camera = { x: 0, y: 0 }
let foods = []
let orbs = []
let snakes = []
let lastTime = 0
let playerScore = 0

/* milestone words cycle */
const MILEWORDS = ['Amazing!', 'Awesome!', 'Unstoppable!', 'Godlike!']

/* Utility */
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const randF = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lenVec = v => Math.hypot(v.x, v.y)
const norm = v => {
	const L = lenVec(v) || 1
	return { x: v.x / L, y: v.y / L }
}

/* ===== Player & Bot constructor (same as before) ===== */
function createSnake(isPlayer = false, name = 'bot') {
	const s = {
		isPlayer,
		name,
		pos: { x: rand(-3, 3), y: rand(-3, 3) },
		dir: norm({ x: randF(-1, 1), y: randF(-1, 1) }),
		speed: isPlayer ? 7.2 : randF(5.2, 7.0),
		segments: [],
		targetLength: INITIAL_LENGTH + (isPlayer ? 0 : rand(4, 10)),
		spacing: 0.58,
		alive: true,
		color: isPlayer
			? '#ffffff'
			: `hsl(${Math.floor(Math.random() * 360)},70%,70%)`,
		ai: { changeTimer: rand(600, 1400), targetFood: null },
		upgradeLevel: 0, // how many milestones applied to this snake (visual)
	}
	for (let i = 0; i < Math.floor(s.targetLength); i++)
		s.segments.push({ x: s.pos.x, y: s.pos.y })
	return s
}

/* Setup player + bots */
snakes = []
snakes.push(createSnake(true, 'you'))
for (let i = 0; i < BOT_COUNT; i++) {
	const b = createSnake(false, 'Enemy' + (i + 1))
	b.pos.x += rand(-SPAWN_RADIUS, SPAWN_RADIUS)
	b.pos.y += rand(-SPAWN_RADIUS, SPAWN_RADIUS)
	snakes.push(b)
}

/* spawn foods */
function spawnFoods() {
	foods = []
	for (let i = 0; i < FOOD_COUNT; i++) {
		const a = Math.random() * Math.PI * 2
		const r = SPAWN_RADIUS + Math.random() * SPAWN_RADIUS * 2
		foods.push({
			x: Math.round(snakes[0].pos.x + Math.cos(a) * r + randF(-6, 6)),
			y: Math.round(snakes[0].pos.y + Math.sin(a) * r + randF(-6, 6)),
			size: Math.random() > 0.85 ? 10 : 6,
			color: Math.random() > 0.8 ? '#ffd166' : '#7cffb2',
		})
	}
}
spawnFoods()

/* spawn one far helper */
function spawnOneFoodFar(cx, cy) {
	const a = Math.random() * Math.PI * 2
	const r = SPAWN_RADIUS + Math.random() * SPAWN_RADIUS * 2
	foods.push({
		x: Math.round(cx + Math.cos(a) * r + randF(-6, 6)),
		y: Math.round(cy + Math.sin(a) * r + randF(-6, 6)),
		size: Math.random() > 0.85 ? 10 : 6,
		color: Math.random() > 0.8 ? '#ffd166' : '#7cffb2',
	})
}

/* Joystick & keyboard (reuse) */
const joyBase = document.getElementById('joy-base')
const joyKnob = document.getElementById('joy-knob')
let joy = { active: false, startX: 0, startY: 0, dx: 0, dy: 0, max: 40 }
;(function setupJoystick() {
	joyBase.addEventListener('pointerdown', ev => {
		ev.preventDefault()
		joy.active = true
		joy.startX = ev.clientX
		joy.startY = ev.clientY
		joyKnob.style.transition = 'transform 0s'
		joyBase.setPointerCapture(ev.pointerId)
	})
	joyBase.addEventListener('pointermove', ev => {
		if (!joy.active) return
		const dx = ev.clientX - joy.startX,
			dy = ev.clientY - joy.startY
		const d = Math.hypot(dx, dy)
		const max = joy.max
		const ndx = dx * Math.min(1, max / Math.max(max, d))
		const ndy = dy * Math.min(1, max / Math.max(max, d))
		joyKnob.style.transform = `translate(${ndx}px, ${ndy}px)`
		joy.dx = clamp(dx / max, -1, 1)
		joy.dy = clamp(dy / max, -1, 1)
	})
	joyBase.addEventListener('pointerup', ev => {
		joy.active = false
		joy.dx = 0
		joy.dy = 0
		joyKnob.style.transition = 'transform 150ms ease'
		joyKnob.style.transform = 'translate(0,0)'
	})
	joyBase.addEventListener('touchstart', e => e.preventDefault(), {
		passive: false,
	})
})()

window.addEventListener('keydown', e => {
	const p = snakes[0]
	if (!p || !p.alive) return
	if (e.key === 'ArrowUp') {
		p.dir = { x: 0, y: -1 }
	}
	if (e.key === 'ArrowDown') {
		p.dir = { x: 0, y: 1 }
	}
	if (e.key === 'ArrowLeft') {
		p.dir = { x: -1, y: 0 }
	}
	if (e.key === 'ArrowRight') {
		p.dir = { x: 1, y: 0 }
	}
})

/* Draw helpers (same as before, with label for bots) */
function clear() {
	ctx.clearRect(0, 0, canvas.width, canvas.height)
}
function worldToScreen(wx, wy) {
	const w = canvas.width / DPR,
		h = canvas.height / DPR
	const sx = w / 2 + (wx - camera.x) * TILE
	const sy = h / 2 + (wy - camera.y) * TILE
	return { x: sx, y: sy }
}

function drawGrid() {
	const w = canvas.width / DPR,
		h = canvas.height / DPR
	const camXpx = camera.x * TILE,
		camYpx = camera.y * TILE
	const gridSize = TILE
	ctx.save()
	ctx.translate(-(camXpx % gridSize), -(camYpx % gridSize))
	ctx.strokeStyle = 'rgba(255,255,255,0.03)'
	ctx.lineWidth = 1
	for (let x = -gridSize * 40; x <= w + gridSize * 40; x += gridSize) {
		ctx.beginPath()
		ctx.moveTo(x, -gridSize * 40)
		ctx.lineTo(x, h + gridSize * 40)
		ctx.stroke()
	}
	for (let y = -gridSize * 40; y <= h + gridSize * 40; y += gridSize) {
		ctx.beginPath()
		ctx.moveTo(-gridSize * 40, y)
		ctx.lineTo(w + gridSize * 40, y)
		ctx.stroke()
	}
	ctx.restore()
}

function drawFoods() {
	const cx = canvas.width / DPR / 2,
		cy = canvas.height / DPR / 2
	ctx.save()
	ctx.translate(cx - camera.x * TILE, cy - camera.y * TILE)
	for (const f of foods.concat(orbs)) {
		ctx.beginPath()
		ctx.fillStyle = f.color
		ctx.shadowColor = f.color
		ctx.shadowBlur = 10
		ctx.arc(f.x * TILE, f.y * TILE, f.size, 0, Math.PI * 2)
		ctx.fill()
		ctx.shadowBlur = 0
	}
	ctx.restore()
}

function drawSnakes() {
	const cx = canvas.width / DPR / 2,
		cy = canvas.height / DPR / 2
	ctx.save()
	ctx.translate(cx - camera.x * TILE, cy - camera.y * TILE)
	for (const s of snakes) {
		if (!s.alive) continue
		// head
		ctx.beginPath()
		ctx.fillStyle = s.color
		ctx.shadowColor = s.color
		ctx.shadowBlur = 16 + s.upgradeLevel * 6
		ctx.arc(
			s.pos.x * TILE,
			s.pos.y * TILE,
			SEGMENT * 0.6 * (1 + s.upgradeLevel * 0.06),
			0,
			Math.PI * 2
		)
		ctx.fill()
		ctx.shadowBlur = 0
		// body
		ctx.fillStyle = s.isPlayer ? '#fff' : s.color
		for (let i = 0; i < s.segments.length; i++) {
			const p = s.segments[i]
			const r =
				SEGMENT *
				(0.9 - (i / s.segments.length) * 0.45) *
				(1 + s.upgradeLevel * 0.03)
			ctx.beginPath()
			ctx.arc(p.x * TILE, p.y * TILE, r / 2, 0, Math.PI * 2)
			ctx.fill()
		}
		// name label if bot
		if (!s.isPlayer) {
			ctx.fillStyle = 'rgba(255,255,255,0.95)'
			ctx.font = `${12 + s.upgradeLevel}px sans-serif`
			ctx.fillText('Enemy', s.pos.x * TILE + 10, s.pos.y * TILE - 10)
		}
	}
	ctx.restore()
}

/* update logic similar to previous with AI & movement */
function updateSnake(s, dt) {
	if (!s.alive) return
	if (s.isPlayer) {
		if (joy.active && (Math.abs(joy.dx) > 0.02 || Math.abs(joy.dy) > 0.02)) {
			const nd = norm({ x: joy.dx, y: joy.dy })
			s.dir.x += (nd.x - s.dir.x) * 0.18
			s.dir.y += (nd.y - s.dir.y) * 0.18
			const n = norm(s.dir)
			s.dir.x = n.x
			s.dir.y = n.y
		}
	} else {
		s.ai.changeTimer -= dt * 1000
		if (s.ai.targetFood) {
			if (!foods.includes(s.ai.targetFood) && !orbs.includes(s.ai.targetFood))
				s.ai.targetFood = null
		}
		if (!s.ai.targetFood) {
			let best = null,
				bd = 1e9
			for (const f of foods) {
				const d = Math.hypot(f.x - s.pos.x, f.y - s.pos.y)
				if (d < bd) {
					bd = d
					best = f
				}
			}
			if (bd < 30) s.ai.targetFood = best
		}
		if (s.ai.changeTimer <= 0) {
			s.ai.changeTimer = rand(600, 1600)
			s.dir.x += randF(-0.6, 0.6)
			s.dir.y += randF(-0.6, 0.6)
			let nd = norm(s.dir)
			s.dir.x = nd.x
			s.dir.y = nd.y
		}
		if (s.ai.targetFood) {
			const to = {
				x: s.ai.targetFood.x - s.pos.x,
				y: s.ai.targetFood.y - s.pos.y,
			}
			const nd = norm(to)
			s.dir.x += (nd.x - s.dir.x) * 0.08
			s.dir.y += (nd.y - s.dir.y) * 0.08
			let n = norm(s.dir)
			s.dir.x = n.x
			s.dir.y = n.y
		}
		// avoidance
		let closest = null,
			cd = 1e9
		for (const other of snakes) {
			if (other === s || !other.alive) continue
			const d = Math.hypot(other.pos.x - s.pos.x, other.pos.y - s.pos.y)
			if (d < cd) {
				cd = d
				closest = other
			}
		}
		if (closest && cd < 6) {
			const away = norm({
				x: s.pos.x - closest.pos.x,
				y: s.pos.y - closest.pos.y,
			})
			s.dir.x += (away.x * 0.8 - s.dir.x) * 0.2
			s.dir.y += (away.y * 0.8 - s.dir.y) * 0.2
			let n = norm(s.dir)
			s.dir.x = n.x
			s.dir.y = n.y
		}
	}

	// move
	s.pos.x += s.dir.x * s.speed * dt
	s.pos.y += s.dir.y * s.speed * dt

	// camera follows player
	if (s.isPlayer) {
		camera.x += (s.pos.x - camera.x) * 0.14
		camera.y += (s.pos.y - camera.y) * 0.14
	}

	// maintain segments
	const targetSegCount = Math.max(3, Math.floor(s.targetLength))
	while (s.segments.length < targetSegCount)
		s.segments.push({ x: s.pos.x, y: s.pos.y })
	while (s.segments.length > targetSegCount) s.segments.pop()
	let prev = { x: s.pos.x, y: s.pos.y }
	for (let i = 0; i < s.segments.length; i++) {
		const p = s.segments[i]
		const dx = prev.x - p.x,
			dy = prev.y - p.y
		const dist = Math.hypot(dx, dy) || 0.0001
		const targetDist = s.spacing
		const move = (dist - targetDist) * 0.6
		if (move > 0.0001) {
			p.x += (dx / dist) * move
			p.y += (dy / dist) * move
		}
		prev = p
	}
}

/* eating & collision logic (same as before) */
function checkFoodEats() {
	for (const s of snakes) {
		if (!s.alive) continue
		for (let i = foods.length - 1; i >= 0; i--) {
			const f = foods[i]
			const d = Math.hypot(s.pos.x - f.x, s.pos.y - f.y)
			if (d < 0.9) {
				foods.splice(i, 1)
				s.targetLength += 1 + Math.random() * 1.8
				if (s.isPlayer) {
					playerScore += 1
					scoreEl.textContent = playerScore
					checkMilestone(playerScore)
				}
				spawnOneFoodFar(s.pos.x, s.pos.y)
			}
		}
		for (let i = orbs.length - 1; i >= 0; i--) {
			const f = orbs[i]
			const d = Math.hypot(s.pos.x - f.x, s.pos.y - f.y)
			if (d < 0.9) {
				orbs.splice(i, 1)
				s.targetLength += 1
				if (s.isPlayer) {
					playerScore += 1
					scoreEl.textContent = playerScore
					checkMilestone(playerScore)
				}
			}
		}
	}
}

/* head vs body collision: if head hits any other segment -> the head snake dies */
function checkHeadBodyCollisions() {
	for (const A of snakes) {
		if (!A.alive) continue
		for (const B of snakes) {
			if (!B.alive) continue
			if (A === B) continue
			for (let i = 0; i < B.segments.length; i++) {
				const seg = B.segments[i]
				const d = Math.hypot(A.pos.x - seg.x, A.pos.y - seg.y)
				if (d < 0.6) {
					killSnake(A, B, i)
					i = B.segments.length
					break
				}
			}
			if (!A.alive) break
		}
	}
}

/* death -> spawn orbs from victim */
function killSnake(victim, bySnake, segIndex = 0) {
	if (!victim.alive) return
	victim.alive = false
	const segs = victim.segments.length
	const count = Math.min(segs, MAX_ORBS_ON_DEATH)
	for (let i = 0; i < count; i++) {
		const idx = Math.floor((i * segs) / count)
		const p = victim.segments[idx]
		orbs.push({
			x: p.x + randF(-0.2, 0.2),
			y: p.y + randF(-0.2, 0.2),
			size: Math.random() > 0.8 ? 9 : 5,
			color: '#ffd166',
		})
	}
	if (bySnake && bySnake.isPlayer && victim !== bySnake) {
		playerScore += Math.floor(victim.targetLength / 2)
		scoreEl.textContent = playerScore
		checkMilestone(playerScore)
	}
	// respawn bot or player after timeout
	if (!victim.isPlayer) {
		setTimeout(() => {
			const a = Math.random() * Math.PI * 2,
				r = SPAWN_RADIUS + Math.random() * SPAWN_RADIUS
			victim.pos.x = snakes[0].pos.x + Math.cos(a) * r
			victim.pos.y = snakes[0].pos.y + Math.sin(a) * r
			victim.dir = norm({ x: randF(-1, 1), y: randF(-1, 1) })
			victim.targetLength = rand(6, 12)
			victim.segments = []
			for (let i = 0; i < victim.targetLength; i++)
				victim.segments.push({ x: victim.pos.x, y: victim.pos.y })
			victim.alive = true
			victim.ai.targetFood = null
		}, 2000 + Math.random() * 3000)
	} else {
		setTimeout(() => {
			const p = snakes[0]
			p.pos = { x: 0, y: 0 }
			p.dir = norm({ x: 1, y: 0 })
			p.targetLength = INITIAL_LENGTH
			p.segments = []
			for (let i = 0; i < p.targetLength; i++)
				p.segments.push({ x: p.pos.x, y: p.pos.y })
			p.alive = true
			playerScore = 0
			scoreEl.textContent = playerScore
		}, 1500)
	}
}

/* Milestone: called whenever player's score increases; triggers only when score %100 ==0 */
let lastMilestoneTriggered = 0
function checkMilestone(score) {
	if (score > 0 && score % 100 === 0 && score !== lastMilestoneTriggered) {
		lastMilestoneTriggered = score
		onScoreMilestone(score)
	}
}

/* onScoreMilestone: visual overlay, bring foods/bots closer, buff player visuals, buff bots */
function onScoreMilestone(scoreVal) {
	// overlay text selection (cycle)
	const idx = (scoreVal / 100 - 1) % MILEWORDS.length
	const word = MILEWORDS[idx]
	milestoneText.textContent = word
	milestoneOverlay.classList.add('show')
	setTimeout(() => milestoneOverlay.classList.remove('show'), 1500)

	// Bring existing foods and orbs closer to player (lerp)
	const player = snakes[0]
	const LERP = 0.28 // how strongly they move toward player
	for (const f of foods) {
		f.x = f.x + (player.pos.x - f.x) * LERP * (0.9 + Math.random() * 0.2)
		f.y = f.y + (player.pos.y - f.y) * LERP * (0.9 + Math.random() * 0.2)
	}
	for (const o of orbs) {
		o.x = o.x + (player.pos.x - o.x) * LERP * 0.9
		o.y = o.y + (player.pos.y - o.y) * LERP * 0.9
	}

	// Bring bots closer & buff them slightly
	for (const b of snakes) {
		if (b === player) continue
		// teleport a bit closer (lerp pos)
		b.pos.x = b.pos.x + (player.pos.x - b.pos.x) * 0.18
		b.pos.y = b.pos.y + (player.pos.y - b.pos.y) * 0.18
		// increase speed a bit (cap it)
		b.speed = Math.min(10.5, b.speed + 0.4)
		// increase AI aggression: lower changeTimer so they track food quicker
		b.ai.changeTimer = Math.max(200, b.ai.changeTimer * 0.7)
	}

	// Reduce spawn radius moderately so future foods spawn closer (min clamp)
	SPAWN_RADIUS = Math.max(14, SPAWN_RADIUS - 3)

	// Upgrade player's visuals (stacked upgrades)
	player.upgradeLevel = Math.min(8, player.upgradeLevel + 1)
	// Slight gameplay buff: a small speed boost and segment size effect
	player.speed = Math.min(12, player.speed + 0.35)
	SEGMENT = Math.min(30, SEGMENT + 0.8) // grow segment size gradually (visual)
}

/* checkFoodEats, checkHeadBodyCollisions, killSnake are above (used as-is) */

/* main update + render functions (combined) */
function updateAll(dt) {
	for (const s of snakes) updateSnake(s, dt)
	checkFoodEats()
	checkHeadBodyCollisions()
	if (orbs.length > 120) {
		while (orbs.length > 80) {
			const o = orbs.pop()
			foods.push({ x: o.x, y: o.y, size: o.size, color: o.color })
		}
	}
}

function renderAll() {
	clear()
	drawGrid()
	drawFoods()
	drawSnakes()
}

/* main loop */
function loop(ts) {
	if (!lastTime) lastTime = ts
	const dt = Math.min(0.05, (ts - lastTime) / 1000)
	lastTime = ts

	const player = snakes[0]
	// joystick influence
	if (
		player.alive &&
		joy.active &&
		(Math.abs(joy.dx) > 0.02 || Math.abs(joy.dy) > 0.02)
	) {
		const nd = norm({ x: joy.dx, y: joy.dy })
		player.dir.x += (nd.x - player.dir.x) * 0.18
		player.dir.y += (nd.y - player.dir.y) * 0.18
		const n = norm(player.dir)
		player.dir.x = n.x
		player.dir.y = n.y
	}

	updateAll(dt)
	renderAll()

	requestAnimationFrame(loop)
}

/* start */
requestAnimationFrame(loop)

/* prevent accidental page scrolling while joystick active */
document.addEventListener(
	'touchmove',
	e => {
		if (joy.active) e.preventDefault()
	},
	{ passive: false }
)

/* initial camera & score display */
camera.x = snakes[0].pos.x
camera.y = snakes[0].pos.y
playerScore = 0
scoreEl.textContent = playerScore
