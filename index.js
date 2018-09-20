'use strict'

module.exports = function Loot(mod) {
	let location = null
	let lootTimeout = null
	let items = new Map()

	mod.command.add('loot', {
		$default() {
			mod.settings.enabled = !mod.settings.enabled
			mod.command.message(`${mod.settings.enabled ? 'en' : 'dis'}abled`)
		},
		auto() {
			mod.settings.auto = !mod.settings.auto
			mod.command.message(`auto-loot ${mod.settings.auto ? 'en' : 'dis'}abled`)
		}
	})

	mod.game.me.on('change_zone', () => {
		items.clear()
	})

	mod.hook('S_RETURN_TO_LOBBY', 1, () => {
		items.clear()
	})

	mod.hook('C_PLAYER_LOCATION', 5, event => {
		location = event.loc
	})

	mod.hook('S_SPAWN_DROPITEM', 6, event => {
		if (mod.settings.blacklist.includes(event.item))
			return
		// is motes?
		if (8000 <= event.item && event.item <= 8025)
			return

		if (event.owners.some(owner => owner.playerId === mod.game.me.playerId)) {
			items.set(event.gameId, Object.assign(event, {priority: 0}))

			if (mod.settings.auto && !lootTimeout)
				tryLoot()
		}
	})

	mod.hook('C_TRY_LOOT_DROPITEM', 4, () => {
		if (mod.settings.enabled && !lootTimeout)
			lootTimeout = setTimeout(tryLoot, mod.settings.interval)
	})

	mod.hook('S_DESPAWN_DROPITEM', 4, event => {
		items.delete(event.gameId)
	})

	function tryLoot() {
		clearTimeout(lootTimeout)
		lootTimeout = null

		if (!items.size || mod.game.me.mounted)
			return

		for(let item of [...items.values()].sort((a, b) => a.priority - b.priority))
			if (location.dist3D(item.loc) <= mod.settings.radius) {
				mod.toServer('C_TRY_LOOT_DROPITEM', 4, item)
				lootTimeout = setTimeout(tryLoot, Math.min(mod.settings.interval * ++item.priority, mod.settings.throttleMax))
				return
			}

		if (mod.settings.auto)
			setTimeout(tryLoot, mod.settings.scanInterval)
	}
}