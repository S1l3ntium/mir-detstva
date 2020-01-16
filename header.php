<!DOCTYPE html>
<html lang="ru">

<head>
	<meta charset="utf-8">
	<title>Мир Детства</title>
	<link rel="manifest" href="/manifest.json">
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
	<meta http-equiv="X-UA-Compatible" content="IE=edge" />
	<base href="/">
	<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
	<link rel="icon" type="image/svg+xml" sizes="any" href="/favicon.svg" />
	<link rel="apple-touch-icon" sizes="57x57" href="/img/apple-touch-icon-57x57.png">
	<link rel="apple-touch-icon" sizes="60x60" href="/img/apple-touch-icon-60x60.png">
	<link rel="apple-touch-icon" sizes="72x72" href="/img/apple-touch-icon-72x72.png">
	<link rel="apple-touch-icon" sizes="76x76" href="/img/apple-touch-icon-76x76.png">
	<link rel="apple-touch-icon" sizes="114x114" href="/img/apple-touch-icon-114x114.png">
	<link rel="apple-touch-icon" sizes="120x120" href="/img/apple-touch-icon-120x120.png">
	<link rel="apple-touch-icon" sizes="144x144" href="/img/apple-touch-icon-144x144.png">
	<link rel="apple-touch-icon" sizes="152x152" href="/img/apple-touch-icon-152x152.png">
	<link rel="apple-touch-icon" sizes="180x180" href="/img/apple-touch-icon-180x180.png">
	<link rel="mask-icon" href="/img/safari-pinned-tab.svg" color="#3d578f">
	<meta name="apple-mobile-web-app-capable" content="yes">
	<meta name="apple-mobile-web-app-title" content="Мир Детства">
	<meta name="mobile-web-app-capable" content="yes">
	<meta name="application-name" content="Мир Детства">
	<meta name="theme-color" content="#3862ba">
	<?php wp_head(); ?>
</head>

<body>
	<div id="app" v-bar="{ scrollingPhantomDelay: 500 }">
		<div id="appWrap" @scroll="handleScroll()" infinite-wrapper>
			<v-touch class="touchHead altShow" v-if="!showMobileMenu" @swiperight="showMobileMenu = true">
			</v-touch>
			<header>
				<div class="wrapper">
					<div class="logo">
						<?php the_custom_logo(); ?>
					</div>
					<div class="menu" :class="{ menuShow: showMobileMenu }">
						<div class="wrap">
							<div class="menuClose">
								<button @click="showMobileMenu = false">Скрыть</button>
							</div>
							<nav>
								<?php wp_nav_menu(array(
                                        'menu'            => 'top_nav',
										'container'       => 'div',
										'container_class' => 'nav',
										'menu_class'      => 'nav',
										'menu_id'         => '',
										'echo'            => true,
										'fallback_cb'     => 'wp_page_menu',
										'before'          => '',
										'after'           => '',
										'link_before'     => '',
										'link_after'      => '',
                                        'items_wrap'      => '<ul id="%1$s" class="%2$s">%3$s</ul>',
										'depth'           => 0,
										'walker'          => '',
									)); ?>
							</nav>
							
						</div>
						<v-touch class="touchHead altHide" v-if="showMobileMenu" @swipeleft="showMobileMenu = false">
						</v-touch>
					</div>
					<div class="info">
						<a href="tel:+7 (473)-258-64-20" class="phone">+7 (473)-258-64-20</a>
						<div class="mobileBtnMenu" @click="showMobileMenu = true"></div>
					</div>
                    <div class="s-header__basket-wr woocommerce">
                        <?php
                        global $woocommerce; ?>
                        <a href="<?php echo $woocommerce->cart->get_cart_url() ?>" class="basket-btn basket-btn_fixed-xs">
                            <span class="basket-btn__counter">(<?php echo sprintf($woocommerce->cart->cart_contents_count); ?>)</span>
                        </a>
                    </div>
				</div>
				<transition name="fade" v-cloak>
					<div class="menuOverlay" v-show="showMobileMenu"></div>
				</transition>
			</header>