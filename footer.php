<footer>
	<div class="wrapper">
		<div class="colFooter colContact">
			<div class="linkWrap">
				<a href="/contacts" class="under alt1">Контакты</a> </div>
			<a href="tel:+7(473)229-34-70" class="phone">+7 (473) 229 - 34 - 70</a>
			<a href="tel:+7(473)258-64-20" class="phone">+7 (473) 258 - 64 - 20</a>
		</div>
		<div class="colFooter colNav">
		<nav>
								<?php wp_nav_menu(array(
                                        'menu'            => 'footer_nav',
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
		<div class="colFooter colSocial">
            <div class="socialTitle">Наши соцсети</div>
            <a href="https://vk.com/gorkikaruseli" target="_blank"><i class="fa fa-vk"></i></a>
            <a href="https://www.instagram.com/gorkikaruseli/" target="_blank"><i class="fa fa-instagram"></i></a>
        </div>
	</div>
	<div class="secondFooter">
		<div class="wrapper">
			<div class="colFooter">
				<p>
					© 2013 - 2019 Мир Детства<br>
					Производство детских игровых и&nbsp;спортивных&nbsp;комплексов </p>
			</div>
		</div>
	</div>
</footer>

<transition name="fade" v-cloak>
	<button class="btn btnFixed" v-show="showScroll" v-scroll-to="'#app'"></button>
</transition>
</div>
</div>

<script src="https://code.jquery.com/jquery-3.3.1.min.js" integrity="sha256-FgpCb/KJQlLNfOu91ta32o/NMZxltwRo8QtmkMRdAu8=" crossorigin="anonymous"></script>

<?php wp_footer(); ?>


</body>

</html>