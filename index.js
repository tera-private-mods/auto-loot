const Command = require('command'),
	config = require('./config.json'),
	blacklist = config.blacklist.concat(config.motes),
	trash = config.trash.concat(config.crystals, config.strongboxes)

module.exports = function Loot(dispatch) {
	const command = Command(dispatch)

	let auto = config.modes.auto || false,
		autotrash = config.modes.trash || false,
		enabled = config.modes.easy || true

	let gameId = null,
		playerId = -1,
		myLoc = null,
		mounted = false,
		inven = null,
		loot = new Map(),
		lootTimeout = null

	let commands = {
		auto: {
			alias: ['auto', 'autoloot', 'toggle'],
			run: function() {
				auto = !auto
				command.message(`Autoloot mode toggled: ${auto}`)
				if(auto && !lootTimeout) tryLoot()
				else {
					clearTimeout(lootTimeout)
					lootTimeout = null
				}
			}
		},
		enable: {
			alias: ['enable', 'on'],
			run: function() {
				enabled = true
				command.message('Easy looting is enabled.')
			}
		},
		disable: {
			alias: ['disable', 'off'],
			run: function() {
				enabled = false
				command.message('Easy looting is disabled.')
			}
		},
		autotrash: {
			alias: ['autotrash', 'trash'],
			run: function() {
				autotrash = !autotrash

				command.message('Autotrash toggled: ' + (autotrash ? 'on' : 'off'))
			}
		}
	}

	dispatch.hook('S_LOGIN', 9, event => { ({gameId, playerId} = event) })

	command.add('loot', c => {
		if(c)
			for(let cmd in commands)
				if(commands[cmd].alias.includes(c))
					commands[cmd].run()
	})

	dispatch.hook('S_LOAD_TOPO', 3, event => {
		myLoc = event.loc
		mounted = false
		loot.clear()
	})

	dispatch.hook('C_PLAYER_LOCATION', 3, event => { myLoc = event.loc })
	dispatch.hook('S_RETURN_TO_LOBBY', 'raw', () => { loot.clear() })

	dispatch.hook('S_MOUNT_VEHICLE', 2, event => { if(event.gameId.equals(gameId)) mounted = true })
	dispatch.hook('S_UNMOUNT_VEHICLE', 2, event => { if(event.gameId.equals(gameId)) mounted = false })

	dispatch.hook('S_SPAWN_DROPITEM', 6, event => {
		if(event.owners.some(owner => owner.playerId === playerId) && !blacklist.includes(event.item)) {
			loot.set(event.gameId.toString(), Object.assign(event, {priority: 0}))

			if(auto && !lootTimeout) tryLoot()
		}
	})

	dispatch.hook('C_TRY_LOOT_DROPITEM', 4, event => {
		if(enabled && !lootTimeout) lootTimeout = setTimeout(tryLoot, config.lootInterval)
	})

	dispatch.hook('S_DESPAWN_DROPITEM', 4, event => { loot.delete(event.gameId.toString()) })

	dispatch.hook('S_INVEN', 12, event => {
		inven = event.first ? event.items : inven.concat(event.items)

		if(!event.more) {
			if(autotrash)
				for(let item of inven)
					if(item.slot < 40) continue // First 40 slots are reserved for equipment, etc.
					else if(trash.includes(item.id)) deleteItem(item.slot, item.amount)

			inven = null
		}
	})

	function deleteItem(slot, amount) {
		dispatch.toServer('C_DEL_ITEM', 2, {
			gameId,
			slot: slot - 40,
			amount
		})
	}

	function tryLoot() {
		clearTimeout(lootTimeout)
		lootTimeout = null

		if(!loot.size) return

		if(!mounted)
			for(let l of [...loot.values()].sort((a, b) => a.priority - b.priority))
				if(myLoc.dist3D(l.loc) <= config.lootRadius) {
					dispatch.toServer('C_TRY_LOOT_DROPITEM', 4, l)
					lootTimeout = setTimeout(tryLoot, Math.min(config.lootInterval * ++l.priority, config.lootThrottleMax))
					return
				}

		if(auto) setTimeout(tryLoot, config.lootScanInterval)
	}
}