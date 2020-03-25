<?php get_header();?>

<section id="anchorCatalog" class="catalog">
	<div class="wrapper">
		<aside class="catalogSidebar">
		</aside>
		<div class="catalogWrap">
			<h1 class="title alt2 catalogTitle">Каталог продукции</h1>
			<div class="catalogParam">
				<div class="search">
					<?php echo do_shortcode('[wcas-search-form]'); ?>
				</div>
			</div>
			<div id="anchorSeries" class="catalogSeries">
				<div class="seriesTitle">Серии</div>
				<div class="seriesWrap">
					<span>
					<div class="seriesItem"></div>
					<div class="seriesItem"></div>
					<div class="seriesItem"></div>
					<div class="seriesItem"></div>
					<div class="seriesItem"></div>
					<div class="seriesItem"></div>
					<div class="seriesItem"></div>
					<div class="seriesItem"></div>
					<div class="seriesItem"></div>
					<div class="seriesItem"></div>
					</span>
					<button class="btn btnMore">Показать все серии</button>
				</div>
			</div>
			<div class="catalogItems">
				<span class="catalogItemsWrap">

				</span>	
			</div>
			<button class="btn btnMore catalogMore">Загрузить еще</button>
		</div>
	</div>
</section>

<?php get_footer(); ?>
