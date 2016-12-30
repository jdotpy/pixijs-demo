Array.prototype.remove = function(obj){
	var index = this.indexOf(obj);
	if (index > -1){
		return this.splice(index, 1);	
	}
	return this;
}

function Blast(){

}

function getRandom(min, max) {
	return Math.random() * (max - min) + min;
}

function distance(from, to) {
	var dx = from.x - to.x;
  	var dy = from.y - to.y;
    var dist = Math.sqrt(dx*dx + dy*dy); 
	return dist;
}

function Engine(options){
	var engine = this;

	engine.loadSprites = function(){
		console.log('Loading Sprites')
		engine.sprites = {};
		var spriteList = [];
		for (var spriteKey of Object.keys(options.spriteSources)){
			spriteList.push(options.spriteSources[spriteKey])	;
		}
		PIXI.loader.add(spriteList).load(function(){
			console.log('Sprites Loaded')
			for (var spriteKey of Object.keys(options.spriteSources)){
				var source = options.spriteSources[spriteKey];
				engine.sprites[spriteKey] = new PIXI.Sprite(PIXI.loader.resources[source].texture);
			}
			console.log('Loaded Sprites:', engine.sprites);
			options.onLoad();
		});
	};

	engine.setup = function (){
		engine.stage = new PIXI.Container(),
		engine.renderer = PIXI.autoDetectRenderer(options.width, options.height);

		// Add to Page
		document.getElementById(options.viewport).appendChild(engine.renderer.view);

		// Load sprites
		engine.loadSprites();
	};

	engine.render = function(){
		engine.renderer.render(engine.stage);
	};

	engine.makeCircle = function(x, y, radius, color){
		var graphic = new PIXI.Graphics();
		graphic.beginFill(color);
		graphic.drawCircle(0, 0, radius);
		graphic.endFill();
		graphic.x = x;
		graphic.y = y;
		return graphic;
	}

	engine.setup();
	return engine;
}

function Player(game, options){
	var player = {};
	player.alive = true;
	player.lives = options.lives || 3;
	player.x = options.x || 0;
	player.y = options.y || 0;
	player.startX = player.x;
	player.startY = player.y;
	player.size = options.size || 30;
	player.vx = 0;
	player.vy = 0;
	player.velocity = 25;
	player.invulnerable = false;
	player.collisionRadius = player.size / 2;
	player.lastFire = (new Date()).getTime();
	player.keys = {
		up: false,
		down: false,
		right: false,
		left: false,
	};

	player.getGraphic = function(sprite){
		var graphic = sprite;
		graphic.width = player.size;
		graphic.height = player.size;
		graphic.anchor.x = 0.5;
		graphic.anchor.y = 0.5;
		graphic.x = player.x;
		graphic.y = player.y;
		game.engine.stage.addChild(graphic);
		return graphic;
	}

	player.die = function(){
		player.graphic.visible = false;
		player.alive = false;
		player.lives -= 1;
		if (player.lives){
			setTimeout(function(){
				player.alive = true;
				player.x = player.startX;
				player.y = player.startY;
				player.graphic.visible = true;
				player.invulnerable = true;
				setTimeout(function(){
					player.invulnerable = false;
				}, 2000)
			}, 1000)
		}
	}
	player.collide = function(){
		if (player.alive && !player.invulnerable){
			player.die();
		}
	}
	player.emitBullet = function(){
		if (!player.alive){
			return false;	
		}
		Bullet(player.game, {
		    color: 0x00FF00,
			enemy: false,
			x: player.x - 15,
			y: player.y - 10,
			vy: -25,
			size: 1
		});
		Bullet(player.game, {
		    color: 0x00FF00,
			enemy: false,
			x: player.x,
			y: player.y - 15,
			vy: -25,
			size: 1
		});
		Bullet(player.game, {
		    color: 0x00FF00,
			enemy: false,
			x: player.x + 15,
			y: player.y - 10,
			vy: -25,
			size: 1
		})
	}
	player.updateVelocity = function(){
		var keys = player.keys;
		var vx = 0;
		var vy = 0;
		if (keys.left){
			vx -= 1;
		}
		if (keys.right){
			vx += 1;
		}
		if (keys.up){
			vy -= 1;
		}
		if (keys.down){
			vy += 1;
		}
		if (vx != 0 && vy != 0){
			vx = Math.sqrt(.5) * vx;
			vy = Math.sqrt(.5) * vy;
		}
		player.vx = vx * player.velocity;
		player.vy = vy * player.velocity;
	}
	player.logic = function(stateInfo){
		// Move
		player.game.move(player, stateInfo);

		// Fire
		if (player.keys.space && stateInfo.currentStateTime - player.lastFire > 500){
			player.emitBullet();
			player.lastFire = (new Date).getTime();
		}
	}

	player.graphic = player.getGraphic(options.sprite);
	player.game = game;

	// Add sprite 
	return player
}

function Bullet(game, opts){
	var bullet = {
		enemy: opts.enemy,
		x:opts.x,
		y:opts.y,
		size:opts.size,
		vx: opts.vx || 0,
		vy: opts.vy || 0,
	};
	bullet.collisionRadius = bullet.size / 2;

	// Update game with self
	game.bullets.push(bullet);

	// Add graphic
	bullet.graphic = game.engine.makeCircle(bullet.x, bullet.y, opts.size, opts.color);
	game.engine.stage.addChild(bullet.graphic);

	// Add references
	bullet.game = game;

	// Functions
	bullet.logic = function(stateInfo){
		bullet.game.move(bullet, stateInfo);
		if (game.isOutsideViewport(bullet.x, bullet.y, bullet.size)){
			game.bullets.remove(bullet);
			game.engine.stage.removeChild(bullet.graphic);
			
		}
	}
	return bullet;
}

function Enemy(game, opts){
	var enemy = {};

	enemy.x = opts.x;
	enemy.y = opts.y;
	enemy.size = opts.size;
	enemy.vx = opts.vx;
	enemy.vy = opts.vy;
	enemy.game = game;
	enemy.size = 30;
	enemy.cooldown = opts.cooldown || 500;
	enemy.bulletSpeed = opts.bulletSpeed || 30;
	enemy.collisionRadius = enemy.size / 2;

	enemy.collide = function(){
		game.enemies.remove(enemy);
		game.engine.stage.removeChild(enemy.graphic);
	}

	enemy.emitBullet = function(){
		Bullet(enemy.game, {
			x: enemy.x,
			y: enemy.y,
			vy: getRandom(0,20),
			vx: getRandom(-5,5),
			vy: enemy.bulletSpeed,
			enemy: true,
			color: 0xe74c3c,
			size: 2
		})
	}
	enemy.getGraphic = function(spriteSource){
		var graphic = new PIXI.Sprite(PIXI.loader.resources[spriteSource].texture);
		graphic.width = enemy.size;
		graphic.height = enemy.size;
		graphic.anchor.x = 0.5;
		graphic.anchor.y = 0.5;
		graphic.x = enemy.x;
		graphic.y = enemy.y;
		game.engine.stage.addChild(graphic);
		return graphic;
	}
	enemy.logic = function(state){
		if (!enemy.lastEmit ||state.currentStateTime - enemy.lastEmit > enemy.cooldown){
			enemy.lastEmit = state.currentStateTime;
			enemy.emitBullet();
		}
	}

	enemy.graphic = enemy.getGraphic(opts.spriteSource);
	game.engine.stage.addChild(enemy.graphic);

	return enemy;
}

LEVELS= [
	function(game){
		game.enemies = [
			Enemy(game, {x: 100, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 200, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 300, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 400, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 500, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 600, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 700, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
		]
	},
	function(game){
		game.enemies = [
			Enemy(game, {x: 100, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 200, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 300, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 400, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 500, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 600, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 700, y: 100, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 50, y: 200, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 150, y: 200, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 250, y: 200, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 350, y: 200, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 450, y: 200, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 550, y: 200, size: 10, spriteSource: game.spriteSources.enemy}),
			Enemy(game, {x: 650, y: 200, size: 10, spriteSource: game.spriteSources.enemy}),
		]
	},
	function(game){
		game.enemies = [
			Enemy(game, {x: 100, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 200, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 300, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 400, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 500, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 600, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 700, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
		]
	},
	function(game){
		game.enemies = [
			Enemy(game, {x: 100, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 200, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 300, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 400, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 500, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 600, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 700, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 50, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 150, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 250, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 350, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 450, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 550, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
			Enemy(game, {x: 650, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed:50, cooldown: 300}),
		]
	},
];

(function Game(options){
	var game = {};
	game.width = 900;
	game.height = 700;

	game.spriteSources = {
		player: 'img/ship.png',
		enemy: 'img/enemy.png',
	};

	game.start = function(){
		game.engine = new Engine({
			viewport: 'viewport',
			spriteSources: game.spriteSources,
			width: game.width,
			height: game.height,
			onLoad: game.onEngineLoad
		})
	}

	game.nextLevel = function(){
		// Reset locations
		game.resetBullets();
		game.player.x = game.player.startX;
		game.player.y = game.player.startY;
		
		// Run the level constructor
		game.level += 1;
		if (game.level < LEVELS.length){
			LEVELS[game.level](game);
		} else{
			console.log('You win!');
			game.play = false;
		}
	}

	game.onEngineLoad = function(){
		game.sprites = game.engine.sprites;
		game.bullets = [];
		game.player = Player(game, {
			x: game.width / 2,
			y: game.height - 100,
			sprite: game.engine.sprites.player,
		})
		game.level = -1;
		game.nextLevel();
		game.bindKeys();
		game.loop();
		game.play = true;
	}

	game.bindKeys = function(){
		function playerKey(key, on){
			return function(){
				game.player.keys[key] = on;
				if (key == 'up' || key == 'down' || key == 'right' || key == 'left'){
					game.player.updateVelocity()
				}
			}
		}
		
		Mousetrap.bind('up', playerKey('up', true), 'keydown');
		Mousetrap.bind('up', playerKey('up', false), 'keyup');	
		Mousetrap.bind('down', playerKey('down', true), 'keydown');
		Mousetrap.bind('down', playerKey('down', false), 'keyup');
		Mousetrap.bind('left', playerKey('left', true), 'keydown');
		Mousetrap.bind('left', playerKey('left', false), 'keyup');
		Mousetrap.bind('right', playerKey('right', true), 'keydown');
		Mousetrap.bind('right', playerKey('right', false), 'keyup');
		Mousetrap.bind('space', playerKey('space', true), 'keydown');
		Mousetrap.bind('space', playerKey('space', false), 'keyup');
		Mousetrap.bind('enter', function(){
			game.lastStateUpdate = null;
			game.play = !game.play;
		});
	}

	game.loop = function (){
		requestAnimationFrame(game.loop);	
		if (game.play){
			game.updateState();
			game.engine.render();
		}
	}

	game.isOutsideViewport = function(x, y, size){
		if (x + size < 0 || x - size > game.width){
			return true;
		} else if (y + size < 0 || y - size > game.height) {
			return true;
		}
		return false;
	}
	game.move = function(obj, stateInfo){
		obj.x = obj.x + obj.vx * (stateInfo.elapsed / 100);
		obj.y = obj.y + obj.vy * (stateInfo.elapsed / 100);
		obj.graphic.x = obj.x;
		obj.graphic.y = obj.y;
	}

	game.resetBullets = function(){
		for (var bullet of game.bullets){
			console.log('Removing:', game.bullets)
			bullet.graphic.visible = false;
			game.engine.stage.removeChild(bullet.graphic);
		}
		game.bullets = [];
	}

	game.updateState = function(){
		var lastTime = game.lastStateUpdate || (new Date).getTime();
		var currentTime = (new Date).getTime();
		var elapsed = lastTime ? currentTime - lastTime : null;
		var stateInfo = {lastStateTime: lastTime,currentStateTime: currentTime, elapsed: elapsed}

		// Movement and player logic
		game.player.logic(stateInfo);
		for (var enemy of game.enemies){
			enemy.logic(stateInfo);
		}
		for (var bullet of game.bullets){
			bullet.logic(stateInfo);
		}
		for (var bullet of game.bullets){
			if (bullet.enemy){
				if (distance(bullet, game.player) < game.player.collisionRadius + bullet.collisionRadius){
					game.player.collide();
				}
			} else {
				for (var enemy of game.enemies){
					if (distance(bullet, enemy) < enemy.collisionRadius + bullet.collisionRadius){
						enemy.collide();
					}
				}
			}
		}

		// Conditionals
		if (game.enemies.length == 0){
			game.nextLevel();
		}
		game.lastStateUpdate = currentTime;
	}

	game.start();
})();
