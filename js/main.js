function getRandom(min, max) {
	return Math.random() * (max - min) + min;
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
		graphic.drawCircle(x, y, radius);
		graphic.endFill();
		return graphic;
	}

	engine.setup();
	return engine;
}

function Player(options){
	var player = this;

	player.alive = true;
	player.lives = options.lives || 2;
	player.x = options.x || 0;
	player.y = options.y || 0;
	player.sprite = options.sprite;

	player.sprite.width = 30;
	player.sprite.height = 30;
}
function Bullet(){
	var Bullet = this;
	Bullet.create = function(opts){
		var bullet = {
			x:opts.x,
			y:opts.y,
			size:opts.size,
			vx: opts.vx,
			vy: opts.vy,
		};
		bullet.prototype = this;
		return bullet;
	}
	return Bullet;
}
Bullets = new Bullet();

(function Game(options){
	var game = this;
	game.width = 900;
	game.height = 700;

	game.spriteSources = {
		player: 'img/ship.png',
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

	game.makePlayer = function(){
		game.player = new Player({sprite: game.engine.sprites.player});
		game.engine.stage.addChild(player.sprite);
	}

	game.makeBullet = function(opts){
		var graphic = game.engine.makeCircle(opts.x, opts.y, opts.size, 0xe74c3c);
		game.bullets.push(Bullets.create(opts));
		game.engine.stage.addChild(graphic);
	}

	game.onEngineLoad = function(){
		game.sprites = game.engine.sprites;
		game.makePlayer();
		game.bullets = [];
		game.loop();
		game.placeRandomBullet();
	}

	game.loop = function (){
		requestAnimationFrame(game.loop);	
		game.updateState();
		game.engine.render();
	}

	game.placeRandomBullet = function(){
		var x = getRandom(100, 300);
		var y = getRandom(100, 300);
		game.makeBullet({x: x, y: y, size: 2});
	}
	game.updateState = function(){
	}

	game.start();
})();
