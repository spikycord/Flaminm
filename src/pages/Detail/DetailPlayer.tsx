import React, { useEffect, useState } from 'react'
import Wrapper from '../../components/Wrapper/Wrapper'
import { BsClockHistory } from 'react-icons/bs'
import { AiFillStar } from 'react-icons/ai'
import { SlArrowRight } from 'react-icons/sl'
import tmdbApi, { TmdbMediaType } from '../../services/tmdbApi'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useParams } from 'react-router-dom'
import { DetailMovie, DetailTV, Movie, TV, TrendingVideo } from '../../Types/Movie'
import { originalImage } from '../../services/apiConfigs'
import { Cast, Crew } from '../../Types/Cast'
import ListMovieHorizontal from '../../components/ListMovieHorizontal/ListMovieHorizontal'
import { VideoResult } from '../../Types/Video'
import Error404Page from '../Error/Error404Page'
import axios, { AxiosError } from 'axios'
import Error500Page from '../Error/Error500Page'
import { LazyLoadImage } from 'react-lazy-load-image-component';
import SkeletonDetail from '../../components/Skeleton/SkeletonDetail'
import { MdOutlineFavorite, MdOutlineFavoriteBorder } from 'react-icons/md'
import withAuth from '../../HOC/withAuth'
import { AuthState } from '../../context/auth/auth.context'
import authServices from '../../services/axiosBackend/auth/auth.services'
import { useForm } from '../../context/form/form.context'
import { useRotatingLoader } from '../../context/RotatingLoader/RotatingLoader.context'
import FBComment from '../../components/FBComment/FBComment'
import { useVideoModal } from '../../context/VideoModal/VideoModal.context'
import { siteMap } from '../../Types/common'

type Props = {
    mediaType: TmdbMediaType
}

const DetailPlayer = ({ mediaType, auth }: Props & { auth: AuthState | null }) => {
    const videoModal = useVideoModal()

    const { id, season, episode } = useParams()
    const location = useLocation()
    const formLogin = useForm()
    const queryClient = useQueryClient()
    const rotatingLoader = useRotatingLoader()

    if (!id || !Number(id)) return <Error404Page />

    const { data, status, error, isFetching, isFetched } = useQuery({
        queryKey: ["detail", mediaType, id],
        queryFn: () => tmdbApi.getDetail<DetailMovie | DetailTV>(mediaType, +id),
        enabled: id !== undefined
    })

    const queryCast = useQuery({
        queryKey: ["cast", mediaType, id],
        queryFn: () => tmdbApi.getCast<{ cast: Cast[], crew: Crew[] }>(mediaType, +id),
        enabled: id !== undefined
    })

    // const recommendsQuery = useQuery({
    //     queryKey: ["recommends", mediaType, id],
    //     queryFn: () => tmdbApi.getRecommendations<Movie | TV | TrendingVideo>(mediaType, +id),
    //     enabled: id !== undefined
    // })

    const handleClickTrailer = (media_type: TmdbMediaType, id: number) => {
        tmdbApi.getVideo<VideoResult>(mediaType, id)
            .then(res => {
                videoModal?.open(`${res.data.results[0].site === "YouTube" ? siteMap.YouTube : siteMap.Vimeo || ""}${res.data.results[0].key || ""}`)
            })
            .catch(error => {
                videoModal?.open(`https://www.youtube.com`)
            })
    }

    if (!data && isFetched || error) {
        if (axios.isAxiosError(error) && (error as AxiosError).response?.status === 404) {
            return <Error404Page />
        }
        return <Error500Page />
    }

    const checkAddedToFavorite = useQuery({
        queryKey: ["detail", { id, mediaType }, "check-favorite"],
        queryFn: () => authServices.checkAddedToFavorite({ id: id + "", type: mediaType }),
        enabled: auth !== null && auth?.isLogged
    })

    const toggleFavoriteMutation = useMutation({
        mutationFn: ({ id, type }: { type: TmdbMediaType; id: string }) => {
            rotatingLoader?.showLoader()
            if (checkAddedToFavorite.data?.data.added) {
                return authServices.removeFavorite({ id, type })
            }
            return authServices.addFavorite({ id, type })
        },
        onSuccess(data, variables, context) {
            if (!checkAddedToFavorite.data) return
            const newData = { ...checkAddedToFavorite.data }
            if (newData.data.added) {
                newData.data.added = false
            }
            else {
                newData.data.added = true
            }
            queryClient.setQueryData(["detail", { id, mediaType }, "check-favorite"], newData)
            queryClient.invalidateQueries({ queryKey: ["favorites"] })
            rotatingLoader?.hiddenLoader()
            return data

        },
        onError(error, variables, context) {
            console.log(error)
            rotatingLoader?.hiddenLoader()
            return error;
        },
    })

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [location])


    const handleToggleFavorite = () => {
        if (!auth?.isLogged) {
            formLogin?.requestOpenForm()
            return
        }
        toggleFavoriteMutation.mutate({ id, type: mediaType })
    }

    return (
        <div className='detail-page' >
            {
                data && <div className="detail h-96 lg:h-screen">
                    <Wrapper className='relative z-[1] flex flex-col md:flex-row gap-8 md:gap-16 py-5 h-full'>
                        {mediaType === "movie" && 
                        <iframe src={"https://vidsrc.to/embed/movie/" + (data.data as DetailMovie).id} width="100%" height="100%" allowFullScreen></iframe> }
                        
                        {mediaType === "tv" && <iframe src={"https://vidsrc.to/embed/tv/" + (data.data as DetailTV).id + "/" + season + "/" + episode} width="100%"         height="100%"></iframe> }
                    </Wrapper>
                </div>

            }
            {isFetching && <SkeletonDetail />}
            
        </div >
    )
}
const WithAuthDetail = withAuth(DetailPlayer)

const DetailPlayerWrapper = (props: Props) => (<> <WithAuthDetail {...props} /> </>)
export default DetailPlayerWrapper