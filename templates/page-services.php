<?php
/*
Template Name: Услуги
*/
get_header();
?>
        <?php if (get_field('servicesSection')) : ?>
            <?php while (have_rows('servicesSection')) : the_row();
                $sS_title = get_sub_field('sS_title');
                $sS_content = get_sub_field('sS_content');
                $sS_slider = get_sub_field('sS_slider');
                $sS_photo = get_sub_field('sS_photo'); ?>
                <section class="company">
                    <div class="wrapper">
                        <h2 class="title alt2"><?php echo $sS_title; ?></h2>
                        <p class="text"><?php echo $sS_content; ?></p>
                        <?php echo $sS_slider; ?>
                        <?php echo $sS_photo; ?>
                    </div>
                </section>
            <?php endwhile; ?>
         <?php endif; ?>
<?php get_footer(); ?>